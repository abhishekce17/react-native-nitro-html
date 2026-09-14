import UIKit

/// High-performance TextKit 2 Engine that builds NSAttributedString directly from C++ AST.
/// ZERO WebKit, ZERO hardcoded styling on native side.
public final class TextKit2HtmlEngine {
  public static let shared = TextKit2HtmlEngine()
  private init() {}

  /// Retrieves pre-parsed C++ AST by astId (or parses fallback HTML) and returns complete NSAttributedString.
  public func buildAttributedString(
    from rawHtml: String? = nil,
    astId: String? = nil,
    containerWidth: CGFloat = 360.0
  ) -> NSAttributedString {
    return FastHtmlParserBridge.buildAttributedString(
      fromAstId: astId,
      fallbackHtml: rawHtml,
      baseStyle: nil,
      tagsStyles: nil,
      containerWidth: containerWidth
    )
  }
}
