import UIKit
import NitroModules

/// Private NSObject shim that acts as UITextViewDelegate.
private final class TextViewDelegateShim: NSObject, UITextViewDelegate {
  weak var owner: HybridNativeHtmlView?

  func textView(
    _ textView: UITextView,
    shouldInteractWith URL: URL,
    in characterRange: NSRange,
    interaction: UITextItemInteraction
  ) -> Bool {
    if let onLinkPress = owner?.onLinkPress {
      onLinkPress(URL.absoluteString)
      return false
    }
    return true
  }

  @available(iOS 17.0, *)
  func textView(
    _ textView: UITextView,
    primaryActionFor textItem: UITextItem,
    defaultAction: UIAction
  ) -> UIAction? {
    if case .link(let url) = textItem.content, let onLinkPress = owner?.onLinkPress {
      return UIAction { _ in onLinkPress(url.absoluteString) }
    }
    return defaultAction
  }
}

final class FastHtmlTextView: UITextView {
  private static let imageCache = NSCache<NSString, UIImage>()
  private var borderLayers: [CALayer] = []
  private var separatorLayers: [CALayer] = []
  private var tableViews: [UIView] = []
  private var imageViews: [UIView] = []

  init() {
    let layoutManager = NSLayoutManager()
    let textStorage = NSTextStorage()
    textStorage.addLayoutManager(layoutManager)
    let textContainer = NSTextContainer(size: .zero)
    layoutManager.addTextContainer(textContainer)
    super.init(frame: .zero, textContainer: textContainer)
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateBorderLayers()
    updateSeparatorLayers()
    updateTableViews()
    updateImageViews()
  }

  func updateSeparatorLayers() {
    separatorLayers.forEach { $0.removeFromSuperlayer() }
    separatorLayers.removeAll()

    guard let attr = attributedText, attr.length > 0 else { return }
    let availW = max(bounds.width - textContainerInset.left - textContainerInset.right, 200.0)

    attr.enumerateAttribute(
      NSAttributedString.Key("FastHtmlSeparatorData"),
      in: NSRange(location: 0, length: attr.length),
      options: []
    ) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary else { return }

      let color = dict["color"] as? UIColor ?? UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0)
      let hrHeight = CGFloat((dict["height"] as? NSNumber)?.doubleValue ?? 1.5)

      let glyphRange = self.layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
      let blockRect = self.layoutManager.boundingRect(forGlyphRange: glyphRange, in: self.textContainer)

      if blockRect.width <= 0 || blockRect.height <= 0 { return }

      let yPos = blockRect.origin.y + self.textContainerInset.top + (blockRect.height - hrHeight) / 2.0
      let xPos = self.textContainerInset.left

      let sepLayer = CALayer()
      sepLayer.frame = CGRect(x: xPos, y: yPos, width: availW, height: hrHeight)
      sepLayer.backgroundColor = color.cgColor
      self.layer.addSublayer(sepLayer)
      self.separatorLayers.append(sepLayer)
    }
  }

  func updateBorderLayers() {
    borderLayers.forEach { $0.removeFromSuperlayer() }
    borderLayers.removeAll()

    guard let attr = attributedText, attr.length > 0 else { return }

    attr.enumerateAttribute(
      NSAttributedString.Key("FastHtmlBorderLeft"),
      in: NSRange(location: 0, length: attr.length),
      options: []
    ) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary else { return }

      let width = (dict["width"] as? NSNumber)?.doubleValue ?? 4.0
      let color = dict["color"] as? UIColor ?? UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0)
      let inset = (dict["inset"] as? NSNumber)?.doubleValue ?? 0.0

      let glyphRange = self.layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
      var blockRect = self.layoutManager.boundingRect(forGlyphRange: glyphRange, in: self.textContainer)

      blockRect.origin.x += self.textContainerInset.left
      blockRect.origin.y += self.textContainerInset.top

      let borderLayer = CALayer()
      let xPos = CGFloat(inset) + self.textContainerInset.left
      borderLayer.frame = CGRect(
        x: xPos,
        y: blockRect.origin.y,
        width: CGFloat(width),
        height: blockRect.height
      )
      borderLayer.backgroundColor = color.cgColor
      borderLayer.cornerRadius = CGFloat(width) / 2.0
      self.layer.addSublayer(borderLayer)
      self.borderLayers.append(borderLayer)
    }
  }

  var onRequestRebuild: (() -> Void)?

  func updateImageViews() {
    imageViews.forEach { $0.removeFromSuperview() }
    imageViews.removeAll()

    guard let attr = attributedText, attr.length > 0 else { return }
    self.layoutManager.ensureLayout(for: self.textContainer)

    attr.enumerateAttribute(
      NSAttributedString.Key("FastHtmlImageData"),
      in: NSRange(location: 0, length: attr.length),
      options: []
    ) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary,
            let urlString = dict["url"] as? String,
            !urlString.isEmpty else { return }

      let caption = (dict["caption"] as? String) ?? ""
      let aspect = (dict["aspectRatio"] as? NSNumber)?.doubleValue ?? 0.3333
      let availableWidth = max(self.bounds.width - self.textContainerInset.left - self.textContainerInset.right, 200.0)
      let initialImgH = CGFloat(ceil(Double(availableWidth) * aspect))
      let initialCapH = !caption.isEmpty ? 24.0 : 0.0
      let totalH = initialImgH + initialCapH

      let glyphRange = self.layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
      var blockRect = self.layoutManager.boundingRect(forGlyphRange: glyphRange, in: self.textContainer)

      blockRect.origin.x += self.textContainerInset.left
      blockRect.origin.y += self.textContainerInset.top

      let containerView = UIView(frame: CGRect(
        x: self.textContainerInset.left,
        y: blockRect.origin.y,
        width: availableWidth,
        height: totalH
      ))
      containerView.backgroundColor = .clear

      let imageView = UIImageView(frame: CGRect(x: 0, y: 0, width: availableWidth, height: initialImgH))
      imageView.contentMode = .scaleAspectFill
      imageView.clipsToBounds = true
      imageView.layer.cornerRadius = 8.0
      imageView.backgroundColor = UIColor(red: 0.94, green: 0.96, blue: 0.98, alpha: 1.0)

      let captionLabel: UILabel?
      if !caption.isEmpty {
        let label = UILabel(frame: CGRect(x: 0, y: initialImgH + 4, width: availableWidth, height: 20))
        label.font = UIFont.italicSystemFont(ofSize: 13.0)
        label.textColor = UIColor(red: 0.28, green: 0.33, blue: 0.41, alpha: 1.0)
        label.text = caption
        label.numberOfLines = 2
        containerView.addSubview(label)
        captionLabel = label
      } else {
        captionLabel = nil
      }

      if let cached = FastHtmlTextView.imageCache.object(forKey: urlString as NSString) {
        imageView.image = cached
      } else if let url = URL(string: urlString) {
        URLSession.shared.dataTask(with: url) { [weak self, weak imageView] data, _, _ in
          if let data = data, let img = UIImage(data: data), img.size.width > 0 {
            let naturalAspect = img.size.height / img.size.width
            FastHtmlTextView.imageCache.setObject(img, forKey: urlString as NSString)
            FastHtmlParserBridge.setImageAspectRatio(naturalAspect, forUrl: urlString)
            DispatchQueue.main.async {
              imageView?.image = img
              self?.onRequestRebuild?()
            }
          }
        }.resume()
      }

      containerView.addSubview(imageView)
      self.addSubview(containerView)
      self.imageViews.append(containerView)
    }
  }

  func updateTableViews() {
    tableViews.forEach { $0.removeFromSuperview() }
    tableViews.removeAll()

    guard let attr = attributedText, attr.length > 0 else { return }
    self.layoutManager.ensureLayout(for: self.textContainer)

    attr.enumerateAttribute(
      NSAttributedString.Key("FastHtmlTableData"),
      in: NSRange(location: 0, length: attr.length),
      options: []
    ) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary,
            let rows = dict["rows"] as? [[NSAttributedString]],
            !rows.isEmpty else { return }

      let borderColor = dict["borderColor"] as? UIColor ?? UIColor(red: 0.12, green: 0.23, blue: 0.54, alpha: 1.0)
      let borderWidth = (dict["borderWidth"] as? NSNumber)?.doubleValue ?? 1.5
      let rowHeight = (dict["rowHeight"] as? NSNumber)?.doubleValue ?? 38.0
      let padH: CGFloat = 12.0
      let padV: CGFloat = 8.0

      let glyphRange = self.layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
      var blockRect = self.layoutManager.boundingRect(forGlyphRange: glyphRange, in: self.textContainer)

      blockRect.origin.x += self.textContainerInset.left
      blockRect.origin.y += self.textContainerInset.top

      let numRows = rows.count
      var numCols = 0
      for r in rows {
        if r.count > numCols { numCols = r.count }
      }
      if numCols == 0 { return }

      // 1. Calculate natural column widths based on cell text measurements
      var colWidths = [CGFloat](repeating: 0, count: numCols)
      for r in rows {
        for (cIndex, cellAttr) in r.enumerated() {
          let textSize = cellAttr.size()
          let cellW = ceil(textSize.width) + (padH * 2)
          if cellW > colWidths[cIndex] {
            colWidths[cIndex] = max(cellW, 60.0)
          }
        }
      }

      let availableWidth = max(self.bounds.width - self.textContainerInset.left - self.textContainerInset.right, 200.0)
      let naturalTotalWidth = colWidths.reduce(0, +)

      // If table fits in view width, expand columns proportionally so it spans full width
      if naturalTotalWidth < availableWidth {
        let extra = (availableWidth - naturalTotalWidth) / CGFloat(numCols)
        for c in 0..<numCols {
          colWidths[c] += extra
        }
      }

      let finalTotalWidth = colWidths.reduce(0, +)
      let totalTableHeight = CGFloat(numRows) * CGFloat(rowHeight)

      // 2. Horizontal UIScrollView
      let scrollView = UIScrollView(frame: CGRect(
        x: self.textContainerInset.left,
        y: blockRect.origin.y,
        width: availableWidth,
        height: totalTableHeight
      ))
      scrollView.showsHorizontalScrollIndicator = true
      scrollView.alwaysBounceHorizontal = false
      scrollView.contentSize = CGSize(width: finalTotalWidth, height: totalTableHeight)
      scrollView.clipsToBounds = true

      // 3. Grid Container View
      let gridView = UIView(frame: CGRect(x: 0, y: 0, width: finalTotalWidth, height: totalTableHeight))
      gridView.backgroundColor = .clear
      gridView.layer.borderColor = borderColor.cgColor
      gridView.layer.borderWidth = CGFloat(borderWidth)
      gridView.layer.masksToBounds = true

      // Compute Column X Offsets
      var colOffsets = [CGFloat](repeating: 0, count: numCols)
      var currentX: CGFloat = 0
      for c in 0..<numCols {
        colOffsets[c] = currentX
        currentX += colWidths[c]
      }

      // Vertical column dividers
      for c in 1..<numCols {
        let vLine = CALayer()
        vLine.frame = CGRect(x: colOffsets[c], y: 0, width: CGFloat(borderWidth), height: totalTableHeight)
        vLine.backgroundColor = borderColor.cgColor
        gridView.layer.addSublayer(vLine)
      }

      // Horizontal row dividers
      for r in 1..<numRows {
        let yPos = CGFloat(r) * CGFloat(rowHeight)
        let hLine = CALayer()
        hLine.frame = CGRect(x: 0, y: yPos, width: finalTotalWidth, height: CGFloat(borderWidth))
        hLine.backgroundColor = borderColor.cgColor
        gridView.layer.addSublayer(hLine)
      }

      // 4. Place Cell Labels
      for (rIndex, row) in rows.enumerated() {
        let rowY = CGFloat(rIndex) * CGFloat(rowHeight)
        for (cIndex, cellAttr) in row.enumerated() {
          let cellX = colOffsets[cIndex]
          let cellW = colWidths[cIndex]
          let label = UILabel(frame: CGRect(
            x: cellX + padH,
            y: rowY + padV,
            width: max(0, cellW - (padH * 2)),
            height: max(0, CGFloat(rowHeight) - (padV * 2))
          ))
          label.attributedText = cellAttr
          label.numberOfLines = 1
          label.adjustsFontSizeToFitWidth = false
          label.lineBreakMode = .byTruncatingTail
          label.isUserInteractionEnabled = false
          gridView.addSubview(label)
        }
      }

      scrollView.addSubview(gridView)
      self.addSubview(scrollView)
      self.tableViews.append(scrollView)
    }
  }
}

/// Native HTML view backed by iOS system HTML engine, implementing the Nitrogen-generated HybridView spec.
open class HybridNativeHtmlView: HybridNativeHtmlViewSpec_base, HybridNativeHtmlViewSpec_protocol {

  // MARK: - HybridView

  public let textView: UITextView
  private let delegateShim = TextViewDelegateShim()

  public var view: UITextView {
    return textView
  }

  // MARK: - Props

  public var html: String? {
    didSet { setNeedsContentUpdate() }
  }

  public var baseStyle: NativeTextStyle? {
    didSet { setNeedsContentUpdate() }
  }

  public var tagsStyles: Dictionary<String, NativeTextStyle>? {
    didSet { setNeedsContentUpdate() }
  }

  public var selectable: Bool? {
    didSet { textView.isSelectable = selectable ?? true }
  }

  public var themeMode: String? {
    didSet { setNeedsContentUpdate() }
  }

  public var onLinkPress: ((_ url: String) -> Void)?
  public var onContentSizeChange: ((_ height: Double) -> Void)?

  // MARK: - Init

  public override init() {
    self.textView = FastHtmlTextView()
    super.init()
    delegateShim.owner = self
    setupTextView()
  }

  private func setupTextView() {
    (textView as? FastHtmlTextView)?.onRequestRebuild = { [weak self] in
      self?.setNeedsContentUpdate()
    }
    textView.isEditable = false
    textView.isScrollEnabled = false
    textView.isSelectable = true
    textView.backgroundColor = .clear
    textView.textContainer.lineFragmentPadding = 0
    textView.textContainerInset = .zero
    textView.delegate = delegateShim
    textView.dataDetectorTypes = []
    textView.setContentHuggingPriority(.required, for: .vertical)
    textView.setContentCompressionResistancePriority(.required, for: .vertical)
    textView.setContentHuggingPriority(.defaultLow, for: .horizontal)
    textView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
  }

  // MARK: - Background Pre-Layout & Content Update

  private var isUpdateScheduled = false

  private func setNeedsContentUpdate() {
    guard !isUpdateScheduled else { return }
    isUpdateScheduled = true

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.isUpdateScheduled = false
      self.updateContent()
    }
  }

  private func updateContent() {
    guard let rawHtml = html, !rawHtml.isEmpty else {
      textView.attributedText = NSAttributedString(string: "")
      onContentSizeChange?(0)
      return
    }

    let targetWidth = textView.bounds.width > 0 ? textView.bounds.width : (UIScreen.main.bounds.width - 64)
    let attr = TextKit2HtmlEngine.shared.buildAttributedString(
      from: rawHtml,
      baseStyle: baseStyle,
      tagsStyles: tagsStyles,
      containerWidth: targetWidth
    )
    textView.attributedText = attr
    (textView as? FastHtmlTextView)?.updateBorderLayers()
    (textView as? FastHtmlTextView)?.updateSeparatorLayers()
    (textView as? FastHtmlTextView)?.updateTableViews()
    (textView as? FastHtmlTextView)?.updateImageViews()
    textView.setNeedsDisplay()
    textView.invalidateIntrinsicContentSize()
    updateAccessibility(for: attr)

    let size = textView.sizeThatFits(CGSize(width: targetWidth, height: .greatestFiniteMagnitude))
    onContentSizeChange?(Double(max(16, ceil(size.height))))
  }

  // MARK: - Web-Standard Accessibility Tree (VoiceOver)

  private func updateAccessibility(for attributedString: NSAttributedString) {
    var elements: [UIAccessibilityElement] = []

    // 1. Whole view container
    let container = UIAccessibilityElement(accessibilityContainer: textView)
    container.accessibilityLabel = attributedString.string
    container.accessibilityFrameInContainerSpace = textView.bounds
    elements.append(container)

    // 2. Discover links for VoiceOver Links Rotor
    attributedString.enumerateAttribute(.link, in: NSRange(location: 0, length: attributedString.length)) { [weak self] value, range, _ in
      guard let self = self, let url = value as? URL else { return }
      let linkElement = UIAccessibilityElement(accessibilityContainer: self.textView)
      let substring = (attributedString.string as NSString).substring(with: range)
      linkElement.accessibilityLabel = substring
      linkElement.accessibilityValue = url.absoluteString
      linkElement.accessibilityTraits = [.link]
      elements.append(linkElement)
    }

    textView.accessibilityElements = elements
  }

  // MARK: - HybridObject Methods

  public func getTextContent() throws -> String {
    return textView.text ?? ""
  }
}


