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

private struct CachedBlockBackground {
  let layer: CALayer
  let range: NSRange
  let color: UIColor
  let borderRadius: CGFloat
  let paddingLeft: CGFloat
  let paddingRight: CGFloat
  let paddingTop: CGFloat
  let paddingBottom: CGFloat
  let marginLeft: CGFloat
  let marginRight: CGFloat
}

private struct CachedSeparator {
  let layer: CALayer
  let range: NSRange
  let height: CGFloat
  let color: UIColor
}

private struct CachedBorder {
  let layer: CALayer
  let range: NSRange
  let width: CGFloat
  let inset: CGFloat
  let color: UIColor
}

private struct CachedImageViewItem {
  let containerView: UIView
  let imageView: UIImageView
  let captionLabel: UILabel?
  let range: NSRange
  let aspect: CGFloat
  let captionHeight: CGFloat
}

/// Ultra-high performance lightweight custom view for HTML tables.
/// Zero nested UILabels or CALayers — draws grid lines & formatted text directly into a single bitmap backing store.
final class FastHtmlTableGridView: UIView {
  var rows: [[NSAttributedString]] = []
  var colWidths: [CGFloat] = []
  var colOffsets: [CGFloat] = []
  var rowHeight: CGFloat = 38.0
  var borderWidth: CGFloat = 1.0
  var borderColor: UIColor = UIColor(red: 0.80, green: 0.84, blue: 0.88, alpha: 1.0)
  var tableBackgroundColor: UIColor = .clear
  var padH: CGFloat = 12.0
  var padV: CGFloat = 8.0

  override init(frame: CGRect) {
    super.init(frame: frame)
    self.backgroundColor = .clear
    self.isOpaque = false
    self.clipsToBounds = true
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func draw(_ rect: CGRect) {
    guard let ctx = UIGraphicsGetCurrentContext(), !rows.isEmpty, !colWidths.isEmpty else { return }
    let totalW = bounds.width
    let totalH = bounds.height

    // 0. Fill table background if specified
    if tableBackgroundColor != .clear {
      ctx.setFillColor(tableBackgroundColor.cgColor)
      ctx.fill(bounds)
    }

    // 1. Draw outer border
    ctx.setStrokeColor(borderColor.cgColor)
    ctx.setLineWidth(borderWidth)
    let halfB = borderWidth / 2.0
    let outerRect = CGRect(x: halfB, y: halfB, width: max(0, totalW - borderWidth), height: max(0, totalH - borderWidth))
    ctx.stroke(outerRect)

    // 2. Draw vertical divider lines
    for c in 1..<colOffsets.count {
      let x = colOffsets[c]
      ctx.move(to: CGPoint(x: x, y: 0))
      ctx.addLine(to: CGPoint(x: x, y: totalH))
    }

    // 3. Draw horizontal divider lines
    for r in 1..<rows.count {
      let y = CGFloat(r) * rowHeight
      ctx.move(to: CGPoint(x: 0, y: y))
      ctx.addLine(to: CGPoint(x: totalW, y: y))
    }
    ctx.strokePath()

    // 4. Draw cell text
    for (rIndex, row) in rows.enumerated() {
      let rowY = CGFloat(rIndex) * rowHeight
      for (cIndex, cellAttr) in row.enumerated() {
        guard cIndex < colOffsets.count, cIndex < colWidths.count else { continue }
        let cellX = colOffsets[cIndex]
        let cellW = colWidths[cIndex]
        let textSize = cellAttr.size()
        let textY = rowY + max(2.0, (rowHeight - textSize.height) / 2.0)
        let cellTextRect = CGRect(
          x: cellX + padH,
          y: textY,
          width: max(0, cellW - (padH * 2)),
          height: max(0, rowHeight - (padV * 2))
        )
        cellAttr.draw(with: cellTextRect, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], context: nil)
      }
    }
  }
}

private struct CachedTableViewItem {
  let scrollView: UIScrollView
  let gridView: FastHtmlTableGridView
  let range: NSRange
  let rows: [[NSAttributedString]]
  let numRows: Int
  let numCols: Int
  let rowHeight: CGFloat
  let borderWidth: CGFloat
  let borderColor: UIColor
  let padH: CGFloat
  let padV: CGFloat
  let minColWidths: [CGFloat]
  let naturalTotalWidth: CGFloat
}

final class FastHtmlTextView: UITextView {
  private static let imageCache = NSCache<NSString, UIImage>()
  private var cachedBlockBackgrounds: [CachedBlockBackground] = []
  private var cachedSeparators: [CachedSeparator] = []
  private var cachedBorders: [CachedBorder] = []
  private var cachedImages: [CachedImageViewItem] = []
  private var cachedTables: [CachedTableViewItem] = []
  private var activeImageTasks: [URLSessionDataTask] = []
  private var lastLaidOutWidth: CGFloat = -1
  private var lastLaidOutAttrLength: Int = -1
  private var needsForceLayout: Bool = true
  var onRequestRebuild: (() -> Void)?

  init() {
    let layoutManager = NSLayoutManager()
    let textStorage = NSTextStorage()
    textStorage.addLayoutManager(layoutManager)
    let textContainer = NSTextContainer(size: .zero)
    layoutManager.addTextContainer(textContainer)
    super.init(frame: .zero, textContainer: textContainer)
    self.isEditable = false
    self.isSelectable = true
    self.isScrollEnabled = false
    self.backgroundColor = .clear
    self.textContainerInset = .zero
    self.textContainer.lineFragmentPadding = 0
    self.textContainer.widthTracksTextView = true
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  deinit {
    cancelPendingDownloads()
  }

  func cancelPendingDownloads() {
    activeImageTasks.forEach { $0.cancel() }
    activeImageTasks.removeAll()
  }

  func setNeedsForceLayout() {
    needsForceLayout = true
  }

  func rebuildSubviews(for attr: NSAttributedString) {
    // 1. Cancel previous pending network tasks
    cancelPendingDownloads()
    needsForceLayout = true
    lastLaidOutWidth = -1

    // 2. Remove previous layers and subviews
    cachedBlockBackgrounds.forEach { $0.layer.removeFromSuperlayer() }
    cachedBlockBackgrounds.removeAll()

    cachedSeparators.forEach { $0.layer.removeFromSuperlayer() }
    cachedSeparators.removeAll()

    cachedBorders.forEach { $0.layer.removeFromSuperlayer() }
    cachedBorders.removeAll()

    cachedImages.forEach { $0.containerView.removeFromSuperview() }
    cachedImages.removeAll()

    cachedTables.forEach {
      $0.scrollView.removeFromSuperview()
      $0.gridView.removeFromSuperview()
    }
    cachedTables.removeAll()

    guard attr.length > 0 else { return }
    let fullRange = NSRange(location: 0, length: attr.length)

    // A. Block Backgrounds
    attr.enumerateAttribute(NSAttributedString.Key("FastHtmlBlockBackground"), in: fullRange, options: []) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary,
            let color = dict["color"] as? UIColor else { return }
      let borderRadius = CGFloat((dict["borderRadius"] as? NSNumber)?.doubleValue ?? 0.0)
      let paddingLeft = CGFloat((dict["paddingLeft"] as? NSNumber)?.doubleValue ?? 0.0)
      let paddingRight = CGFloat((dict["paddingRight"] as? NSNumber)?.doubleValue ?? 0.0)
      let paddingTop = CGFloat((dict["paddingTop"] as? NSNumber)?.doubleValue ?? 0.0)
      let paddingBottom = CGFloat((dict["paddingBottom"] as? NSNumber)?.doubleValue ?? 0.0)
      let marginLeft = CGFloat((dict["marginLeft"] as? NSNumber)?.doubleValue ?? 0.0)
      let marginRight = CGFloat((dict["marginRight"] as? NSNumber)?.doubleValue ?? 0.0)

      let bgLayer = CALayer()
      bgLayer.backgroundColor = color.cgColor
      if borderRadius > 0 {
        bgLayer.cornerRadius = borderRadius
        bgLayer.masksToBounds = true
      }
      self.layer.insertSublayer(bgLayer, at: 0)
      self.cachedBlockBackgrounds.append(CachedBlockBackground(
        layer: bgLayer,
        range: range,
        color: color,
        borderRadius: borderRadius,
        paddingLeft: paddingLeft,
        paddingRight: paddingRight,
        paddingTop: paddingTop,
        paddingBottom: paddingBottom,
        marginLeft: marginLeft,
        marginRight: marginRight
      ))
    }

    // B. Separators
    attr.enumerateAttribute(NSAttributedString.Key("FastHtmlSeparatorData"), in: fullRange, options: []) { [weak self] value, range, _ in
      guard let self = self, let dict = value as? NSDictionary else { return }
      let color = dict["color"] as? UIColor ?? UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0)
      let hrHeight = CGFloat((dict["height"] as? NSNumber)?.doubleValue ?? 1.5)

      let sepLayer = CALayer()
      sepLayer.backgroundColor = color.cgColor
      self.layer.addSublayer(sepLayer)
      self.cachedSeparators.append(CachedSeparator(layer: sepLayer, range: range, height: hrHeight, color: color))
    }

    // C. Borders
    attr.enumerateAttribute(NSAttributedString.Key("FastHtmlBorderLeft"), in: fullRange, options: []) { [weak self] value, range, _ in
      guard let self = self, let dict = value as? NSDictionary else { return }
      let width = CGFloat((dict["width"] as? NSNumber)?.doubleValue ?? 4.0)
      let color = dict["color"] as? UIColor ?? UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0)
      let inset = CGFloat((dict["inset"] as? NSNumber)?.doubleValue ?? 0.0)

      let borderLayer = CALayer()
      borderLayer.backgroundColor = color.cgColor
      borderLayer.cornerRadius = width / 2.0
      self.layer.addSublayer(borderLayer)
      self.cachedBorders.append(CachedBorder(layer: borderLayer, range: range, width: width, inset: inset, color: color))
    }

    // D. Images
    attr.enumerateAttribute(NSAttributedString.Key("FastHtmlImageData"), in: fullRange, options: []) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary,
            let urlString = dict["url"] as? String,
            !urlString.isEmpty else { return }
      let caption = (dict["caption"] as? String) ?? ""
      let aspect = CGFloat((dict["aspectRatio"] as? NSNumber)?.doubleValue ?? 0.3333)
      let capHeight: CGFloat = !caption.isEmpty ? 24.0 : 0.0

      let containerView = UIView(frame: .zero)
      containerView.backgroundColor = .clear

      let imageView = UIImageView(frame: .zero)
      imageView.contentMode = .scaleAspectFill
      imageView.clipsToBounds = true
      let imgBorderRadius = CGFloat((dict["borderRadius"] as? NSNumber)?.doubleValue ?? 0.0)
      if imgBorderRadius > 0 {
        imageView.layer.cornerRadius = imgBorderRadius
      } else {
        imageView.layer.cornerRadius = 0.0
      }
      imageView.backgroundColor = UIColor(red: 0.94, green: 0.96, blue: 0.98, alpha: 1.0)

      let captionLabel: UILabel?
      if !caption.isEmpty {
        let label = UILabel(frame: .zero)
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
        let task = URLSession.shared.dataTask(with: url) { [weak self, weak imageView] data, _, _ in
          if let data = data, let img = UIImage(data: data), img.size.width > 0 {
            let naturalAspect = img.size.height / img.size.width
            FastHtmlTextView.imageCache.setObject(img, forKey: urlString as NSString)
            FastHtmlParserBridge.setImageAspectRatio(naturalAspect, forUrl: urlString)
            DispatchQueue.main.async {
              imageView?.image = img
              self?.onRequestRebuild?()
            }
          }
        }
        self.activeImageTasks.append(task)
        task.resume()
      }

      containerView.addSubview(imageView)
      self.addSubview(containerView)
      self.cachedImages.append(CachedImageViewItem(
        containerView: containerView,
        imageView: imageView,
        captionLabel: captionLabel,
        range: range,
        aspect: aspect,
        captionHeight: capHeight
      ))
    }

    // E. Tables
    attr.enumerateAttribute(NSAttributedString.Key("FastHtmlTableData"), in: fullRange, options: []) { [weak self] value, range, _ in
      guard let self = self,
            let dict = value as? NSDictionary,
            let rows = dict["rows"] as? [[NSAttributedString]],
            !rows.isEmpty else { return }
      let borderColor = dict["borderColor"] as? UIColor ?? UIColor(red: 0.12, green: 0.23, blue: 0.54, alpha: 1.0)
      let borderWidth = CGFloat((dict["borderWidth"] as? NSNumber)?.doubleValue ?? 1.5)
      let rowHeight = CGFloat((dict["rowHeight"] as? NSNumber)?.doubleValue ?? 38.0)
      let padH: CGFloat = 12.0
      let padV: CGFloat = 8.0

      let numRows = rows.count
      var numCols = 0
      for r in rows {
        if r.count > numCols { numCols = r.count }
      }
      guard numCols > 0 else { return }

      var minColWidths = [CGFloat](repeating: 0, count: numCols)
      for r in rows {
        for (cIndex, cellAttr) in r.enumerated() {
          let textSize = cellAttr.size()
          let cellW = ceil(textSize.width) + (padH * 2)
          if cellW > minColWidths[cIndex] {
            minColWidths[cIndex] = max(cellW, 60.0)
          }
        }
      }
      let naturalTotalWidth = minColWidths.reduce(0, +)

      let gridView = FastHtmlTableGridView(frame: .zero)
      gridView.rows = rows
      gridView.rowHeight = rowHeight
      gridView.borderWidth = borderWidth
      gridView.borderColor = borderColor
      if let tblBg = dict["backgroundColor"] as? UIColor {
        gridView.tableBackgroundColor = tblBg
      }
      gridView.padH = padH
      gridView.padV = padV

      let scrollView = UIScrollView(frame: .zero)
      scrollView.showsHorizontalScrollIndicator = true
      scrollView.alwaysBounceHorizontal = false
      scrollView.clipsToBounds = true
      scrollView.addSubview(gridView)
      self.addSubview(scrollView)

      self.cachedTables.append(CachedTableViewItem(
        scrollView: scrollView,
        gridView: gridView,
        range: range,
        rows: rows,
        numRows: numRows,
        numCols: numCols,
        rowHeight: rowHeight,
        borderWidth: borderWidth,
        borderColor: borderColor,
        padH: padH,
        padV: padV,
        minColWidths: minColWidths,
        naturalTotalWidth: naturalTotalWidth
      ))
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let currentWidth = bounds.width
    let textLength = attributedText?.length ?? 0
    if currentWidth > 0 && currentWidth == lastLaidOutWidth && textLength == lastLaidOutAttrLength && !needsForceLayout {
      return
    }
    if currentWidth > 0 {
      lastLaidOutWidth = currentWidth
      lastLaidOutAttrLength = textLength
      needsForceLayout = false
    }
    layoutCachedElements()
  }

  private func layoutCachedElements() {
    guard let attr = attributedText, attr.length > 0 else { return }
    let availW = max(bounds.width - textContainerInset.left - textContainerInset.right, 200.0)

    if self.textContainer.size.width != availW {
      self.textContainer.size = CGSize(width: availW, height: .greatestFiniteMagnitude)
    }
    self.layoutManager.ensureLayout(for: self.textContainer)

    CATransaction.begin()
    CATransaction.setDisableActions(true)

    // Layout Block Backgrounds
    for item in cachedBlockBackgrounds {
      layoutManager.ensureLayout(forCharacterRange: item.range)
      let glyphRange = layoutManager.glyphRange(forCharacterRange: item.range, actualCharacterRange: nil)
      if glyphRange.location == NSNotFound || glyphRange.length == 0 { continue }
      var blockRect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
      if blockRect.width <= 0 || blockRect.height <= 0 { continue }
      blockRect.origin.x += textContainerInset.left
      blockRect.origin.y += textContainerInset.top

      let xPos = textContainerInset.left + item.marginLeft
      let width = max(availW - item.marginLeft - item.marginRight, 10.0)
      item.layer.frame = CGRect(x: xPos, y: blockRect.origin.y, width: width, height: blockRect.height)
      if item.borderRadius > 0 {
        item.layer.cornerRadius = item.borderRadius
        item.layer.masksToBounds = true
      } else {
        item.layer.cornerRadius = 0
        item.layer.masksToBounds = false
      }
    }

    // Layout Separators
    for item in cachedSeparators {
      layoutManager.ensureLayout(forCharacterRange: item.range)
      let glyphRange = layoutManager.glyphRange(forCharacterRange: item.range, actualCharacterRange: nil)
      if glyphRange.location == NSNotFound || glyphRange.length == 0 { continue }
      let blockRect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
      if blockRect.width <= 0 || blockRect.height <= 0 { continue }
      let yPos = blockRect.origin.y + textContainerInset.top + (blockRect.height - item.height) / 2.0
      let xPos = textContainerInset.left
      item.layer.frame = CGRect(x: xPos, y: yPos, width: availW, height: item.height)
    }

    // Layout Borders
    for item in cachedBorders {
      layoutManager.ensureLayout(forCharacterRange: item.range)
      let glyphRange = layoutManager.glyphRange(forCharacterRange: item.range, actualCharacterRange: nil)
      if glyphRange.location == NSNotFound || glyphRange.length == 0 { continue }
      var blockRect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
      if blockRect.width <= 0 || blockRect.height <= 0 { continue }
      blockRect.origin.x += textContainerInset.left
      blockRect.origin.y += textContainerInset.top
      let xPos = item.inset + textContainerInset.left
      item.layer.frame = CGRect(x: xPos, y: blockRect.origin.y, width: item.width, height: blockRect.height)
    }

    // Layout Images
    for item in cachedImages {
      layoutManager.ensureLayout(forCharacterRange: item.range)
      let glyphRange = layoutManager.glyphRange(forCharacterRange: item.range, actualCharacterRange: nil)
      if glyphRange.location == NSNotFound || glyphRange.length == 0 { continue }
      var blockRect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
      if blockRect.width <= 0 || blockRect.height <= 0 { continue }
      blockRect.origin.x += textContainerInset.left
      blockRect.origin.y += textContainerInset.top

      let imgH = ceil(availW * item.aspect)
      let totalH = imgH + item.captionHeight

      item.containerView.frame = CGRect(
        x: textContainerInset.left,
        y: blockRect.origin.y,
        width: availW,
        height: totalH
      )
      item.imageView.frame = CGRect(x: 0, y: 0, width: availW, height: imgH)
      if let capLabel = item.captionLabel {
        capLabel.frame = CGRect(x: 0, y: imgH + 4, width: availW, height: 20)
      }
    }

    // Layout Tables (using FastHtmlTableGridView - ZERO subview bloat & ZERO measurement inside layout pass!)
    for item in cachedTables {
      layoutManager.ensureLayout(forCharacterRange: item.range)
      let glyphRange = layoutManager.glyphRange(forCharacterRange: item.range, actualCharacterRange: nil)
      if glyphRange.location == NSNotFound || glyphRange.length == 0 { continue }
      var blockRect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
      if blockRect.width <= 0 || blockRect.height <= 0 { continue }
      blockRect.origin.x += textContainerInset.left
      blockRect.origin.y += textContainerInset.top

      var colWidths = item.minColWidths
      let naturalTotalWidth = item.naturalTotalWidth
      if naturalTotalWidth < availW {
        let extra = (availW - naturalTotalWidth) / CGFloat(item.numCols)
        for c in 0..<item.numCols {
          colWidths[c] += extra
        }
      }

      let finalTotalWidth = colWidths.reduce(0, +)
      let totalTableHeight = CGFloat(item.numRows) * item.rowHeight

      var colOffsets = [CGFloat](repeating: 0, count: item.numCols)
      var currentX: CGFloat = 0
      for c in 0..<item.numCols {
        colOffsets[c] = currentX
        currentX += colWidths[c]
      }

      item.gridView.colWidths = colWidths
      item.gridView.colOffsets = colOffsets

      item.scrollView.frame = CGRect(
        x: textContainerInset.left,
        y: blockRect.origin.y,
        width: availW,
        height: totalTableHeight
      )
      item.scrollView.contentSize = CGSize(width: max(availW, finalTotalWidth), height: totalTableHeight)
      item.gridView.frame = CGRect(x: 0, y: 0, width: max(availW, finalTotalWidth), height: totalTableHeight)
      item.gridView.setNeedsDisplay()
    }

    CATransaction.commit()
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

  public var astId: String? {
    didSet {
      if oldValue != astId {
        setNeedsContentUpdate()
      }
    }
  }

  public var selectable: Bool? {
    didSet {
      if oldValue != selectable {
        textView.isSelectable = selectable ?? true
      }
    }
  }

  public var onLinkPress: ((_ url: String) -> Void)?
  public var onContentSizeChange: ((_ height: Double) -> Void)?
  private var lastReportedHeight: Double = -1

  // MARK: - Init

  public override init() {
    self.textView = FastHtmlTextView()
    super.init()
    delegateShim.owner = self
    setupTextView()
  }

  deinit {
    (textView as? FastHtmlTextView)?.cancelPendingDownloads()
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
    guard let currentAstId = astId, !currentAstId.isEmpty else {
      (textView as? FastHtmlTextView)?.cancelPendingDownloads()
      textView.attributedText = NSAttributedString(string: "")
      (textView as? FastHtmlTextView)?.rebuildSubviews(for: NSAttributedString(string: ""))
      lastReportedHeight = 0
      onContentSizeChange?(0)
      return
    }

    let targetWidth = textView.bounds.width > 0 ? textView.bounds.width : (UIScreen.main.bounds.width - 64)
    let attr = TextKit2HtmlEngine.shared.buildAttributedString(
      astId: currentAstId,
      containerWidth: targetWidth
    )
    textView.attributedText = attr
    (textView as? FastHtmlTextView)?.rebuildSubviews(for: attr)
    textView.setNeedsLayout()
    textView.layoutIfNeeded()
    textView.invalidateIntrinsicContentSize()
    updateAccessibility(for: attr)

    let size = textView.sizeThatFits(CGSize(width: targetWidth, height: .greatestFiniteMagnitude))
    let newHeight = Double(max(16, ceil(size.height)))
    if abs(lastReportedHeight - newHeight) > 1.0 {
      lastReportedHeight = newHeight
      onContentSizeChange?(newHeight)
    }
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


