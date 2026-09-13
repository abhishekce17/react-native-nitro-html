import UIKit

/// High-performance TextKit 2 Engine that builds NSAttributedString directly from C++ AST.
/// ZERO WebKit, ZERO hardcoded styling on native side.
public final class TextKit2HtmlEngine {
  public static let shared = TextKit2HtmlEngine()
  private init() {}

  private func nativeTextStyleToDict(_ style: NativeTextStyle) -> [String: Any] {
    var d: [String: Any] = [:]
    if let v = style.fontSize { d["fontSize"] = v }
    if let v = style.color { d["color"] = v }
    if let v = style.lineHeight { d["lineHeight"] = v }
    if let v = style.fontFamily { d["fontFamily"] = v }
    if let v = style.fontWeight { d["fontWeight"] = v }
    if let v = style.fontStyle { d["fontStyle"] = v }
    if let v = style.letterSpacing { d["letterSpacing"] = v }
    if let v = style.textAlign { d["textAlign"] = v }
    if let v = style.textTransform { d["textTransform"] = v }
    if let v = style.textIndent { d["textIndent"] = v }
    if let v = style.textDecorationLine { d["textDecorationLine"] = v }
    if let v = style.textDecorationColor { d["textDecorationColor"] = v }
    if let v = style.textDecorationStyle { d["textDecorationStyle"] = v }
    if let v = style.backgroundColor { d["backgroundColor"] = v }
    if let v = style.opacity { d["opacity"] = v }
    if let v = style.margin { d["margin"] = v }
    if let v = style.marginVertical { d["marginVertical"] = v }
    if let v = style.marginHorizontal { d["marginHorizontal"] = v }
    if let v = style.marginTop { d["marginTop"] = v }
    if let v = style.marginBottom { d["marginBottom"] = v }
    if let v = style.marginLeft { d["marginLeft"] = v }
    if let v = style.marginRight { d["marginRight"] = v }
    if let v = style.padding { d["padding"] = v }
    if let v = style.paddingVertical { d["paddingVertical"] = v }
    if let v = style.paddingHorizontal { d["paddingHorizontal"] = v }
    if let v = style.paddingTop { d["paddingTop"] = v }
    if let v = style.paddingBottom { d["paddingBottom"] = v }
    if let v = style.paddingLeft { d["paddingLeft"] = v }
    if let v = style.paddingRight { d["paddingRight"] = v }
    if let v = style.borderWidth { d["borderWidth"] = v }
    if let v = style.borderColor { d["borderColor"] = v }
    if let v = style.borderRadius { d["borderRadius"] = v }
    if let v = style.borderLeftColor { d["borderLeftColor"] = v }
    if let v = style.borderLeftWidth { d["borderLeftWidth"] = v }
    if let v = style.fontFeatureSettings { d["fontFeatureSettings"] = v }
    return d
  }

  /// Parses raw HTML via C++ FastHtmlParserBridge and returns complete NSAttributedString.
  public func buildAttributedString(
    from rawHtml: String,
    baseStyle: NativeTextStyle? = nil,
    tagsStyles: Dictionary<String, NativeTextStyle>? = nil,
    containerWidth: CGFloat = 360.0
  ) -> NSAttributedString {
    let baseDict = baseStyle.map { nativeTextStyleToDict($0) }

    var tagsDict: [String: [String: Any]]? = nil
    if let ts = tagsStyles {
      var d: [String: [String: Any]] = [:]
      for (k, v) in ts {
        d[k] = nativeTextStyleToDict(v)
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
