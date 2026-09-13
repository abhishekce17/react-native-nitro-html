import UIKit

/// High-performance TextKit 2 Engine that builds NSAttributedString directly from C++ AST.
/// ZERO WebKit, ZERO hardcoded styling on native side.
public final class TextKit2HtmlEngine {
  public static let shared = TextKit2HtmlEngine()
  private init() {}

  /// Parses raw HTML via C++ FastHtmlParserBridge and returns complete NSAttributedString.
  public func buildAttributedString(
    from rawHtml: String,
    baseStyle: NativeTextStyle? = nil,
    tagsStyles: Dictionary<String, NativeTextStyle>? = nil,
    containerWidth: CGFloat = 360.0
  ) -> NSAttributedString {
    var baseDict: [String: Any]? = nil
    if let b = baseStyle {
      var d: [String: Any] = [:]
      if let s = b.fontSize { d["fontSize"] = s }
      if let c = b.color { d["color"] = c }
      if let f = b.fontFamily { d["fontFamily"] = f }
      if let w = b.fontWeight { d["fontWeight"] = w }
      if let st = b.fontStyle { d["fontStyle"] = st }
      if let bg = b.backgroundColor { d["backgroundColor"] = bg }
      if let lh = b.lineHeight { d["lineHeight"] = lh }
      baseDict = d
    }

    var tagsDict: [String: [String: Any]]? = nil
    if let ts = tagsStyles {
      var d: [String: [String: Any]] = [:]
      for (k, v) in ts {
        var sub: [String: Any] = [:]
        if let s = v.fontSize { sub["fontSize"] = s }
        if let c = v.color { sub["color"] = c }
        if let f = v.fontFamily { sub["fontFamily"] = f }
        if let w = v.fontWeight { sub["fontWeight"] = w }
        if let st = v.fontStyle { sub["fontStyle"] = st }
        if let bg = v.backgroundColor { sub["backgroundColor"] = bg }
        if let lh = v.lineHeight { sub["lineHeight"] = lh }
        d[k] = sub
      }
      tagsDict = d
    }

    return FastHtmlParserBridge.buildAttributedString(
      fromHtml: rawHtml,
      baseStyle: baseDict,
      tagsStyles: tagsDict,
      containerWidth: containerWidth
    )
  }
}
