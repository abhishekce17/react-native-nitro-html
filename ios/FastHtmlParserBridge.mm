#import "FastHtmlParserBridge.h"
#include <memory>
#include <string>
#include <vector>
#include <unordered_map>
#include "HybridFastHtmlParser.hpp"
#import <UIKit/UIKit.h>
#import <CoreText/CoreText.h>

using namespace margelo::nitro::fasthtmlparser;

@implementation FastHtmlParserBridge

static NSCache<NSString *, UIColor *> *sColorCache = nil;
static NSCache<NSString *, UIFont *> *sFontCache = nil;

static UIColor* colorFromHexString(const std::string& hex) {
    if (hex.empty()) return nil;

    if (!sColorCache) {
        sColorCache = [[NSCache alloc] init];
        sColorCache.countLimit = 256;
    }

    NSString *key = [NSString stringWithUTF8String:hex.c_str()];
    UIColor *cached = [sColorCache objectForKey:key];
    if (cached) return cached;

    const char *str = hex.c_str();
    while (*str == ' ' || *str == '\t' || *str == '\n' || *str == '\r') str++;
    if (*str == '#') str++;

    size_t len = strlen(str);
    while (len > 0 && (str[len - 1] == ' ' || str[len - 1] == '\t' || str[len - 1] == '\n' || str[len - 1] == '\r')) len--;

    if (len != 6 && len != 8) return nil;

    auto hexVal = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    };

    unsigned int rgbValue = 0;
    for (size_t i = 0; i < len; ++i) {
        int v = hexVal(str[i]);
        if (v < 0) return nil;
        rgbValue = (rgbValue << 4) | static_cast<unsigned int>(v);
    }

    UIColor *color = nil;
    if (len == 6) {
        color = [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16) / 255.0
                                green:((rgbValue & 0x00FF00) >> 8) / 255.0
                                 blue:(rgbValue & 0x0000FF) / 255.0
                                alpha:1.0];
    } else {
        color = [UIColor colorWithRed:((rgbValue & 0xFF000000) >> 24) / 255.0
                                green:((rgbValue & 0x00FF0000) >> 16) / 255.0
                                 blue:((rgbValue & 0x0000FF00) >> 8) / 255.0
                                alpha:(rgbValue & 0x000000FF) / 255.0];
    }

    if (color) {
        [sColorCache setObject:color forKey:key];
    }
    return color;
}

static NSString* cleanFontName(NSString *name) {
    if (!name) return @"";
    NSString *trimmed = [name stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (([trimmed hasPrefix:@"'"] && [trimmed hasSuffix:@"'"]) ||
        ([trimmed hasPrefix:@"\""] && [trimmed hasSuffix:@"\""])) {
        if (trimmed.length >= 2) {
            trimmed = [trimmed substringWithRange:NSMakeRange(1, trimmed.length - 2)];
        }
    }
    return [trimmed stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
}

static UIFont* fontFromNodeProps(
    const std::string& family,
    double size,
    const std::string& weight,
    const std::string& style,
    const std::string& fontFeatureSettings = ""
) {
    CGFloat ptSize = size > 0 ? static_cast<CGFloat>(size) : 16.0;

    if (!sFontCache) {
        sFontCache = [[NSCache alloc] init];
        sFontCache.countLimit = 512;
    }

    NSString *cacheKey = [NSString stringWithFormat:@"%s|%.1f|%s|%s|%s",
                          family.c_str(), ptSize, weight.c_str(), style.c_str(), fontFeatureSettings.c_str()];
    UIFont *cachedFont = [sFontCache objectForKey:cacheKey];
    if (cachedFont) return cachedFont;
    UIFontWeight uiWeight = UIFontWeightRegular;
    if (weight == "900" || weight == "black") {
        uiWeight = UIFontWeightBlack;
    } else if (weight == "800" || weight == "heavy") {
        uiWeight = UIFontWeightHeavy;
    } else if (weight == "700" || weight == "bold") {
        uiWeight = UIFontWeightBold;
    } else if (weight == "600" || weight == "semibold" || weight == "semi-bold") {
        uiWeight = UIFontWeightSemibold;
    } else if (weight == "500" || weight == "medium") {
        uiWeight = UIFontWeightMedium;
    } else if (weight == "300" || weight == "light") {
        uiWeight = UIFontWeightLight;
    } else if (weight == "200" || weight == "ultralight" || weight == "extra-light") {
        uiWeight = UIFontWeightUltraLight;
    } else if (weight == "100" || weight == "thin") {
        uiWeight = UIFontWeightThin;
    }

    UIFontDescriptorSymbolicTraits traits = 0;
    if (weight == "bold" || weight == "700" || weight == "800" || weight == "900" || weight == "600" || weight == "semibold" || weight == "heavy" || weight == "black") {
        traits |= UIFontDescriptorTraitBold;
    }
    if (style == "italic") {
        traits |= UIFontDescriptorTraitItalic;
    }

    UIFont *baseFont = nil;
    if (!family.empty()) {
        NSString *rawFamily = [NSString stringWithUTF8String:family.c_str()];
        NSArray<NSString *> *candidates = [rawFamily componentsSeparatedByString:@","];

        for (NSString *candRaw in candidates) {
            NSString *cand = cleanFontName(candRaw);
            if (cand.length == 0) continue;

            NSString *candLower = [cand lowercaseString];
            if ([candLower isEqualToString:@"monospace"]) {
                baseFont = [UIFont monospacedSystemFontOfSize:ptSize weight:uiWeight];
                if (traits != 0) {
                    UIFontDescriptor *tDesc = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
                    if (tDesc) {
                        UIFont *f = [UIFont fontWithDescriptor:tDesc size:ptSize];
                        if (f) baseFont = f;
                    }
                }
                break;
            } else if ([candLower isEqualToString:@"serif"]) {
                if (@available(iOS 13.0, *)) {
                    UIFontDescriptor *serifDesc = [[UIFont systemFontOfSize:ptSize weight:uiWeight].fontDescriptor fontDescriptorWithDesign:UIFontDescriptorSystemDesignSerif];
                    if (serifDesc) {
                        if (traits != 0) {
                            UIFontDescriptor *tDesc = [serifDesc fontDescriptorWithSymbolicTraits:traits];
                            if (tDesc) serifDesc = tDesc;
                        }
                        baseFont = [UIFont fontWithDescriptor:serifDesc size:ptSize];
                    }
                }
                if (!baseFont) {
                    baseFont = [UIFont fontWithName:@"Georgia" size:ptSize];
                    if (baseFont && traits != 0) {
                        UIFontDescriptor *tDesc = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
                        if (tDesc) {
                            UIFont *f = [UIFont fontWithDescriptor:tDesc size:ptSize];
                            if (f) baseFont = f;
                        }
                    }
                }
                if (baseFont) break;
            } else if ([candLower isEqualToString:@"sans-serif"] || [candLower isEqualToString:@"system"] || [candLower isEqualToString:@"system-ui"] || [candLower isEqualToString:@"-apple-system"]) {
                baseFont = [UIFont systemFontOfSize:ptSize weight:uiWeight];
                if (traits != 0) {
                    UIFontDescriptor *tDesc = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
                    if (tDesc) {
                        UIFont *f = [UIFont fontWithDescriptor:tDesc size:ptSize];
                        if (f) baseFont = f;
                    }
                }
                break;
            } else if ([candLower isEqualToString:@"cursive"]) {
                baseFont = [UIFont italicSystemFontOfSize:ptSize];
                if (traits != 0) {
                    UIFontDescriptor *tDesc = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
                    if (tDesc) {
                        UIFont *f = [UIFont fontWithDescriptor:tDesc size:ptSize];
                        if (f) baseFont = f;
                    }
                }
                if (baseFont) break;
            } else {
                // 1. Try direct PostScript / full font name
                UIFont *customFont = [UIFont fontWithName:cand size:ptSize];
                if (customFont) {
                    baseFont = customFont;
                    if (traits != 0) {
                        UIFontDescriptor *traitDesc = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
                        if (traitDesc) {
                            UIFont *f = [UIFont fontWithDescriptor:traitDesc size:ptSize];
                            if (f) baseFont = f;
                        }
                    }
                    break;
                }

                // 2. Try UIFontDescriptor with UIFontDescriptorFamilyAttribute if family exists
                NSArray<NSString *> *familyFonts = [UIFont fontNamesForFamilyName:cand];
                if (familyFonts && familyFonts.count > 0) {
                    UIFontDescriptor *desc = [UIFontDescriptor fontDescriptorWithFontAttributes:@{
                        UIFontDescriptorFamilyAttribute: cand
                    }];
                    if (traits != 0) {
                        UIFontDescriptor *traitDesc = [desc fontDescriptorWithSymbolicTraits:traits];
                        if (traitDesc) desc = traitDesc;
                    }
                    if (desc) {
                        UIFont *descFont = [UIFont fontWithDescriptor:desc size:ptSize];
                        if (descFont) {
                            baseFont = descFont;
                            break;
                        }
                    }
                }
            }
        }
    }

    if (!baseFont) {
        baseFont = [UIFont systemFontOfSize:ptSize weight:uiWeight];
        if (traits != 0) {
            UIFontDescriptor *tDesc = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
            if (tDesc) {
                UIFont *f = [UIFont fontWithDescriptor:tDesc size:ptSize];
                if (f) baseFont = f;
            }
        }
    }

    if (!fontFeatureSettings.empty() && baseFont) {
        NSString *ffs = [NSString stringWithUTF8String:fontFeatureSettings.c_str()];
        NSMutableArray<NSDictionary *> *features = [NSMutableArray array];

        if ([ffs containsString:@"tnum"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kNumberSpacingType),
                UIFontFeatureSelectorIdentifierKey: @(kMonospacedNumbersSelector)
            }];
        }
        if ([ffs containsString:@"pnum"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kNumberSpacingType),
                UIFontFeatureSelectorIdentifierKey: @(kProportionalNumbersSelector)
            }];
        }
        if ([ffs containsString:@"frac"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kFractionsType),
                UIFontFeatureSelectorIdentifierKey: @(kDiagonalFractionsSelector)
            }];
        }
        if ([ffs containsString:@"smcp"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kLowerCaseType),
                UIFontFeatureSelectorIdentifierKey: @(kLowerCaseSmallCapsSelector)
            }];
        }
        if ([ffs containsString:@"c2sc"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kUpperCaseType),
                UIFontFeatureSelectorIdentifierKey: @(kUpperCaseSmallCapsSelector)
            }];
        }
        if ([ffs containsString:@"onum"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kNumberCaseType),
                UIFontFeatureSelectorIdentifierKey: @(kLowerCaseNumbersSelector)
            }];
        }
        if ([ffs containsString:@"lnum"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kNumberCaseType),
                UIFontFeatureSelectorIdentifierKey: @(kUpperCaseNumbersSelector)
            }];
        }
        if ([ffs containsString:@"zero"]) {
            [features addObject:@{
                UIFontFeatureTypeIdentifierKey: @(kTypographicExtrasType),
                UIFontFeatureSelectorIdentifierKey: @(kSlashedZeroOnSelector)
            }];
        }

        if (features.count > 0) {
            UIFontDescriptor *featureDesc = [baseFont.fontDescriptor fontDescriptorByAddingAttributes:@{
                UIFontDescriptorFeatureSettingsAttribute: features
            }];
            if (featureDesc) {
                UIFont *featureFont = [UIFont fontWithDescriptor:featureDesc size:ptSize];
                if (featureFont) {
                    baseFont = featureFont;
                }
            }
        }
    }

    if (baseFont) {
        [sFontCache setObject:baseFont forKey:cacheKey];
    }
    return baseFont;
}

static NSAttributedString* buildInlineAttributedString(const std::shared_ptr<HybridInlineNode>& node) {
    if (!node) return [[NSAttributedString alloc] initWithString:@""];
    if (node->type_ == "Break") {
        return [[NSAttributedString alloc] initWithString:@"\u2028"];
    }

    NSMutableAttributedString *result = [[NSMutableAttributedString alloc] init];

    if (!node->text_.empty()) {
        NSString *textStr = [NSString stringWithUTF8String:node->text_.c_str()];
        [result appendAttributedString:[[NSAttributedString alloc] initWithString:textStr]];
    }

    for (const auto& child : node->children_) {
        [result appendAttributedString:buildInlineAttributedString(child)];
    }

    if (result.length == 0) {
        return result;
    }

    NSRange fullRange = NSMakeRange(0, result.length);

    // Font
    if (!node->fontFamily_.empty() || node->fontSize_ > 0 || !node->fontWeight_.empty() || !node->fontStyle_.empty() || !node->fontFeatureSettings_.empty()) {
        UIFont *font = fontFromNodeProps(node->fontFamily_, node->fontSize_, node->fontWeight_, node->fontStyle_, node->fontFeatureSettings_);
        if (font) {
            [result addAttribute:NSFontAttributeName value:font range:fullRange];
        }
    }

    // Text Color
    if (!node->color_.empty()) {
        UIColor *textColor = colorFromHexString(node->color_);
        if (textColor) {
            if (node->opacity_ < 1.0) {
                [result addAttribute:NSForegroundColorAttributeName value:[textColor colorWithAlphaComponent:static_cast<CGFloat>(node->opacity_)] range:fullRange];
            } else {
                [result addAttribute:NSForegroundColorAttributeName value:textColor range:fullRange];
            }
        }
    } else if (node->isLink_) {
        [result addAttribute:NSForegroundColorAttributeName value:[UIColor systemBlueColor] range:fullRange];
    }

    // Background Color
    if (!node->backgroundColor_.empty()) {
        UIColor *bgColor = colorFromHexString(node->backgroundColor_);
        if (bgColor) {
            [result addAttribute:NSBackgroundColorAttributeName value:bgColor range:fullRange];
        }
    }

    // Underline
    if (node->isUnderline_ || node->isLink_) {
        [result addAttribute:NSUnderlineStyleAttributeName value:@(NSUnderlineStyleSingle) range:fullRange];
        if (node->isLink_ && node->textDecorationColor_.empty()) {
            [result addAttribute:NSUnderlineColorAttributeName value:[UIColor systemBlueColor] range:fullRange];
        }
    }

    // Strikethrough
    if (node->isStrikethrough_) {
        [result addAttribute:NSStrikethroughStyleAttributeName value:@(NSUnderlineStyleSingle) range:fullRange];
    }

    // Custom decoration color
    if (!node->textDecorationColor_.empty()) {
        UIColor *decColor = colorFromHexString(node->textDecorationColor_);
        if (decColor) {
            if (node->isUnderline_ || node->isLink_) [result addAttribute:NSUnderlineColorAttributeName value:decColor range:fullRange];
            if (node->isStrikethrough_) [result addAttribute:NSStrikethroughColorAttributeName value:decColor range:fullRange];
        }
    }

    // Custom decoration style
    if (!node->textDecorationStyle_.empty()) {
        if (node->textDecorationStyle_ == "dashed") {
            if (node->isUnderline_ || node->isLink_) [result addAttribute:NSUnderlineStyleAttributeName value:@(NSUnderlineStylePatternDash | NSUnderlineStyleSingle) range:fullRange];
            if (node->isStrikethrough_) [result addAttribute:NSStrikethroughStyleAttributeName value:@(NSUnderlineStylePatternDash | NSUnderlineStyleSingle) range:fullRange];
        } else if (node->textDecorationStyle_ == "double") {
            if (node->isUnderline_ || node->isLink_) [result addAttribute:NSUnderlineStyleAttributeName value:@(NSUnderlineStyleDouble) range:fullRange];
            if (node->isStrikethrough_) [result addAttribute:NSStrikethroughStyleAttributeName value:@(NSUnderlineStyleDouble) range:fullRange];
        }
    }

    // Letter Spacing
    if (node->letterSpacing_ != 0.0) {
        [result addAttribute:NSKernAttributeName value:@(node->letterSpacing_) range:fullRange];
    }

    // Link URL
    if (node->isLink_ && !node->url_.empty()) {
        NSString *urlStr = [NSString stringWithUTF8String:node->url_.c_str()];
        NSURL *url = [NSURL URLWithString:urlStr];
        if (url) {
            [result addAttribute:NSLinkAttributeName value:url range:fullRange];
        }
    }

    // Baseline Shift
    if (node->baselineShift_ != 0.0) {
        [result addAttribute:NSBaselineOffsetAttributeName value:@(node->baselineShift_) range:fullRange];
    }

    return result;
}

static NativeTextStyle nativeTextStyleFromDict(NSDictionary *d) {
    NativeTextStyle s;
    if (d[@"fontSize"]) s.fontSize = [d[@"fontSize"] doubleValue];
    if (d[@"color"]) s.color = std::string([d[@"color"] UTF8String]);
    if (d[@"backgroundColor"]) s.backgroundColor = std::string([d[@"backgroundColor"] UTF8String]);
    if (d[@"fontFamily"]) s.fontFamily = std::string([d[@"fontFamily"] UTF8String]);
    if (d[@"fontWeight"]) s.fontWeight = std::string([d[@"fontWeight"] UTF8String]);
    if (d[@"fontStyle"]) s.fontStyle = std::string([d[@"fontStyle"] UTF8String]);
    if (d[@"lineHeight"]) s.lineHeight = [d[@"lineHeight"] doubleValue];
    if (d[@"letterSpacing"]) s.letterSpacing = [d[@"letterSpacing"] doubleValue];
    if (d[@"textAlign"]) s.textAlign = std::string([d[@"textAlign"] UTF8String]);
    if (d[@"textTransform"]) s.textTransform = std::string([d[@"textTransform"] UTF8String]);
    if (d[@"textIndent"]) s.textIndent = [d[@"textIndent"] doubleValue];
    if (d[@"textDecorationLine"]) s.textDecorationLine = std::string([d[@"textDecorationLine"] UTF8String]);
    if (d[@"textDecorationColor"]) s.textDecorationColor = std::string([d[@"textDecorationColor"] UTF8String]);
    if (d[@"textDecorationStyle"]) s.textDecorationStyle = std::string([d[@"textDecorationStyle"] UTF8String]);
    if (d[@"opacity"]) s.opacity = [d[@"opacity"] doubleValue];
    if (d[@"margin"]) s.margin = [d[@"margin"] doubleValue];
    if (d[@"marginVertical"]) s.marginVertical = [d[@"marginVertical"] doubleValue];
    if (d[@"marginHorizontal"]) s.marginHorizontal = [d[@"marginHorizontal"] doubleValue];
    if (d[@"marginTop"]) s.marginTop = [d[@"marginTop"] doubleValue];
    if (d[@"marginBottom"]) s.marginBottom = [d[@"marginBottom"] doubleValue];
    if (d[@"marginLeft"]) s.marginLeft = [d[@"marginLeft"] doubleValue];
    if (d[@"marginRight"]) s.marginRight = [d[@"marginRight"] doubleValue];
    if (d[@"padding"]) s.padding = [d[@"padding"] doubleValue];
    if (d[@"paddingVertical"]) s.paddingVertical = [d[@"paddingVertical"] doubleValue];
    if (d[@"paddingHorizontal"]) s.paddingHorizontal = [d[@"paddingHorizontal"] doubleValue];
    if (d[@"paddingTop"]) s.paddingTop = [d[@"paddingTop"] doubleValue];
    if (d[@"paddingBottom"]) s.paddingBottom = [d[@"paddingBottom"] doubleValue];
    if (d[@"paddingLeft"]) s.paddingLeft = [d[@"paddingLeft"] doubleValue];
    if (d[@"paddingRight"]) s.paddingRight = [d[@"paddingRight"] doubleValue];
    if (d[@"borderWidth"]) s.borderWidth = [d[@"borderWidth"] doubleValue];
    if (d[@"borderColor"]) s.borderColor = std::string([d[@"borderColor"] UTF8String]);
    if (d[@"borderRadius"]) s.borderRadius = [d[@"borderRadius"] doubleValue];
    if (d[@"borderLeftColor"]) s.borderLeftColor = std::string([d[@"borderLeftColor"] UTF8String]);
    if (d[@"borderLeftWidth"]) s.borderLeftWidth = [d[@"borderLeftWidth"] doubleValue];
    if (d[@"fontFeatureSettings"]) s.fontFeatureSettings = std::string([d[@"fontFeatureSettings"] UTF8String]);
    return s;
}

static NSMutableDictionary<NSString *, NSNumber *> *sImageAspectRatios = nil;

+ (void)setImageAspectRatio:(CGFloat)aspect forUrl:(NSString *)url {
    if (!sImageAspectRatios) {
        sImageAspectRatios = [[NSMutableDictionary alloc] init];
    }
    if (url.length > 0 && aspect > 0) {
        sImageAspectRatios[url] = @(aspect);
    }
}

+ (CGFloat)imageAspectRatioForUrl:(NSString *)url {
    if (url.length > 0 && sImageAspectRatios && sImageAspectRatios[url]) {
        return [sImageAspectRatios[url] doubleValue];
    }
    return 0.3333; // Default 3:1 banner ratio until downloaded
}

+ (NSAttributedString *)buildAttributedStringFromHtml:(NSString *)html
                                            baseStyle:(nullable NSDictionary<NSString *, id> *)baseStyleDict
                                           tagsStyles:(nullable NSDictionary<NSString *, NSDictionary<NSString *, id> *> *)tagsStylesDict {
    return [self buildAttributedStringFromHtml:html baseStyle:baseStyleDict tagsStyles:tagsStylesDict containerWidth:360.0];
}

+ (NSAttributedString *)buildAttributedStringFromHtml:(NSString *)html
                                            baseStyle:(nullable NSDictionary<NSString *, id> *)baseStyleDict
                                           tagsStyles:(nullable NSDictionary<NSString *, NSDictionary<NSString *, id> *> *)tagsStylesDict
                                       containerWidth:(CGFloat)containerWidth {
    return [self buildAttributedStringFromAstId:nil
                                   fallbackHtml:html
                                      baseStyle:baseStyleDict
                                     tagsStyles:tagsStylesDict
                                 containerWidth:containerWidth];
}

+ (NSAttributedString *)buildAttributedStringFromAstId:(nullable NSString *)astId
                                              fallbackHtml:(nullable NSString *)html
                                                 baseStyle:(nullable NSDictionary<NSString *, id> *)baseStyleDict
                                                tagsStyles:(nullable NSDictionary<NSString *, NSDictionary<NSString *, id> *> *)tagsStylesDict
                                            containerWidth:(CGFloat)containerWidth {
    std::shared_ptr<HybridParsedArticle> article = nullptr;
    if (astId && astId.length > 0) {
        std::string astIdStr = [astId UTF8String];
        article = HybridFastHtmlParser::getAstFromBuffer(astIdStr);
    }

    if (!article && html && html.length > 0) {
        std::optional<NativeTextStyle> baseStyle = std::nullopt;
        if (baseStyleDict) {
            baseStyle = nativeTextStyleFromDict(baseStyleDict);
        }

        std::optional<std::unordered_map<std::string, NativeTextStyle>> tagsStyles = std::nullopt;
        if (tagsStylesDict) {
            std::unordered_map<std::string, NativeTextStyle> map;
            for (NSString *key in tagsStylesDict) {
                NSDictionary *d = tagsStylesDict[key];
                map[std::string([key UTF8String])] = nativeTextStyleFromDict(d);
            }
            tagsStyles = map;
        }

        std::string htmlStr = [html UTF8String];
        article = HybridFastHtmlParser::parseInternal(htmlStr, baseStyle, tagsStyles);
    }

    if (!article || article->blocks_.empty()) {
        return [[NSAttributedString alloc] initWithString:@""];
    }

    return [self buildAttributedStringFromArticle:article containerWidth:containerWidth];
}

+ (NSAttributedString *)buildAttributedStringFromArticle:(const std::shared_ptr<HybridParsedArticle>&)article
                                          containerWidth:(CGFloat)containerWidth {
    if (!article || article->blocks_.empty()) {
        return [[NSAttributedString alloc] initWithString:@""];
    }

    NSMutableAttributedString *fullText = [[NSMutableAttributedString alloc] init];
    size_t count = article->blocks_.size();

    for (size_t i = 0; i < count; ++i) {
        const auto& block = article->blocks_[i];
        if (!block) continue;

        if (block->type_ == "Separator") {
            CGFloat hrLineH = 8.0;
            CGFloat mt = block->marginTop_ > 0 ? static_cast<CGFloat>(block->marginTop_) : 16.0;
            CGFloat mb = block->marginBottom_ > 0 ? static_cast<CGFloat>(block->marginBottom_) : 16.0;
            UIColor *hrColor = !block->color_.empty() ? colorFromHexString(block->color_) : [UIColor colorWithRed:0.89 green:0.91 blue:0.94 alpha:1.0];

            NSMutableParagraphStyle *hrPara = [[NSMutableParagraphStyle alloc] init];
            hrPara.minimumLineHeight = hrLineH;
            hrPara.maximumLineHeight = hrLineH;
            hrPara.lineSpacing = 0;
            hrPara.paragraphSpacingBefore = mt;
            hrPara.paragraphSpacing = mb;

            NSDictionary *hrAttrs = @{
                NSFontAttributeName: [UIFont systemFontOfSize:14.0],
                NSForegroundColorAttributeName: [UIColor clearColor],
                NSParagraphStyleAttributeName: hrPara,
                @"FastHtmlSeparatorData": @{
                    @"color": hrColor,
                    @"height": @(1.5)
                }
            };

            NSMutableAttributedString *hrBlockAttr = [[NSMutableAttributedString alloc] initWithString:@"—" attributes:hrAttrs];
            [fullText appendAttributedString:hrBlockAttr];
            if (i < count - 1) {
                [fullText appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n"]];
            }
            continue;
        }

        NSMutableAttributedString *blockAttr = [[NSMutableAttributedString alloc] init];

        for (const auto& child : block->children_) {
            [blockAttr appendAttributedString:buildInlineAttributedString(child)];
        }

        if (block->type_ == "CodeBlock" && !block->code_.empty()) {
            UIFont *codeFont = fontFromNodeProps(block->fontFamily_, block->fontSize_, block->fontWeight_, block->fontStyle_, block->fontFeatureSettings_);
            NSMutableDictionary<NSAttributedStringKey, id> *codeAttrs = [NSMutableDictionary dictionary];
            codeAttrs[NSFontAttributeName] = codeFont;
            UIColor *c = colorFromHexString(block->color_);
            if (c) codeAttrs[NSForegroundColorAttributeName] = c;
            NSString *codeStr = [NSString stringWithUTF8String:block->code_.c_str()];
            [blockAttr appendAttributedString:[[NSAttributedString alloc] initWithString:codeStr attributes:codeAttrs]];
        }

        if (block->type_ == "List") {
            CGFloat listLeftMargin = static_cast<CGFloat>(block->marginLeft_ + block->paddingLeft_);
            CGFloat hangingIndent = block->ordered_ ? 20.0 : 16.0;
            CGFloat listMt = block->marginTop_ > 0 ? static_cast<CGFloat>(block->marginTop_) : 0.0;

            for (size_t li = 0; li < block->items_.size(); ++li) {
                const auto& item = block->items_[li];
                if (!item) continue;
                NSUInteger itemStart = blockAttr.length;
                NSString *prefixStr = block->ordered_ ? [NSString stringWithFormat:@"%zu. ", li + 1] : @"• ";
                UIFont *prefixFont = fontFromNodeProps(block->fontFamily_, block->fontSize_, block->fontWeight_, block->fontStyle_, block->fontFeatureSettings_);
                NSMutableDictionary<NSAttributedStringKey, id> *prefixAttrs = [NSMutableDictionary dictionary];
                prefixAttrs[NSFontAttributeName] = prefixFont;
                UIColor *prefixColor = colorFromHexString(block->color_);
                if (prefixColor) prefixAttrs[NSForegroundColorAttributeName] = prefixColor;
                NSAttributedString *prefixAttr = [[NSAttributedString alloc] initWithString:prefixStr attributes:prefixAttrs];
                [blockAttr appendAttributedString:prefixAttr];

                for (const auto& inNode : item->children_) {
                    [blockAttr appendAttributedString:buildInlineAttributedString(inNode)];
                }
                NSMutableParagraphStyle *liStyle = [[NSMutableParagraphStyle alloc] init];
                liStyle.firstLineHeadIndent = listLeftMargin;
                liStyle.headIndent = listLeftMargin + hangingIndent;
                if (block->lineHeight_ > 0) {
                    liStyle.minimumLineHeight = static_cast<CGFloat>(block->lineHeight_);
                    liStyle.maximumLineHeight = static_cast<CGFloat>(block->lineHeight_);
                }
                if (li == 0 && listMt > 0) {
                    liStyle.paragraphSpacingBefore = listMt;
                }
                if (li < block->items_.size() - 1) {
                    liStyle.paragraphSpacing = 6.0;
                    [blockAttr appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n"]];
                } else if (block->marginBottom_ > 0) {
                    liStyle.paragraphSpacing = static_cast<CGFloat>(block->marginBottom_);
                }
                [blockAttr addAttribute:NSParagraphStyleAttributeName value:liStyle range:NSMakeRange(itemStart, blockAttr.length - itemStart)];
            }
        }

        if (blockAttr.length > 0) {
            if (block->type_ != "List") {
                // Treat all intra-block newlines as soft line separators so paragraphSpacing only triggers at block boundaries
                [blockAttr.mutableString replaceOccurrencesOfString:@"\n"
                                                         withString:@"\u2028"
                                                            options:0
                                                              range:NSMakeRange(0, blockAttr.length)];
            }

            if (i < count - 1) {
                [blockAttr appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n"]];
            }

            if (block->type_ != "List") {
                NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
                if (block->marginTop_ > 0) {
                    paragraphStyle.paragraphSpacingBefore = static_cast<CGFloat>(block->marginTop_);
                }
                if (block->marginBottom_ > 0) {
                    paragraphStyle.paragraphSpacing = static_cast<CGFloat>(block->marginBottom_);
                }
                if (block->lineHeight_ > 0) {
                    paragraphStyle.minimumLineHeight = static_cast<CGFloat>(block->lineHeight_);
                    paragraphStyle.maximumLineHeight = static_cast<CGFloat>(block->lineHeight_);
                }
                CGFloat leftIndent = static_cast<CGFloat>(block->marginLeft_ + block->paddingLeft_);
                CGFloat firstLineIndent = static_cast<CGFloat>(block->marginLeft_ + block->paddingLeft_ + block->textIndent_);
                CGFloat rightInset = static_cast<CGFloat>(block->marginRight_ + block->paddingRight_);
                if (leftIndent > 0) {
                    paragraphStyle.headIndent = leftIndent;
                }
                if (firstLineIndent > 0) {
                    paragraphStyle.firstLineHeadIndent = firstLineIndent;
                }
                if (rightInset > 0) {
                    paragraphStyle.tailIndent = -rightInset;
                }
                if (block->textAlign_ == "center") {
                    paragraphStyle.alignment = NSTextAlignmentCenter;
                } else if (block->textAlign_ == "right") {
                    paragraphStyle.alignment = NSTextAlignmentRight;
                } else if (block->textAlign_ == "justify") {
                    paragraphStyle.alignment = NSTextAlignmentJustified;
                } else if (block->textAlign_ == "left") {
                    paragraphStyle.alignment = NSTextAlignmentLeft;
                }
                [blockAttr addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, blockAttr.length)];
            }
            if (!block->backgroundColor_.empty()) {
                UIColor *bg = colorFromHexString(block->backgroundColor_);
                if (bg) {
                    [blockAttr addAttribute:@"FastHtmlBlockBackground"
                                      value:@{
                                          @"color": bg,
                                          @"borderRadius": @(block->borderRadius_),
                                          @"paddingLeft": @(block->paddingLeft_),
                                          @"paddingRight": @(block->paddingRight_),
                                          @"paddingTop": @(block->paddingTop_),
                                          @"paddingBottom": @(block->paddingBottom_),
                                          @"marginLeft": @(block->marginLeft_),
                                          @"marginRight": @(block->marginRight_)
                                      }
                                      range:NSMakeRange(0, blockAttr.length)];
                }
            }
            if (block->borderLeftWidth_ > 0 && !block->borderLeftColor_.empty()) {
                UIColor *blc = colorFromHexString(block->borderLeftColor_);
                if (blc) {
                    [blockAttr addAttribute:@"FastHtmlBorderLeft"
                                      value:@{
                                          @"width": @(block->borderLeftWidth_),
                                          @"color": blc,
                                          @"inset": @(block->marginLeft_)
                                      }
                                      range:NSMakeRange(0, blockAttr.length)];
                }
            }
            if (block->type_ == "Table" && !block->rows_.empty()) {
                NSMutableArray *rowsArr = [NSMutableArray array];
                for (const auto& row : block->rows_) {
                    if (!row) continue;
                    NSMutableArray *cellsArr = [NSMutableArray array];
                    for (const auto& cell : row->cells_) {
                        if (!cell) continue;
                        NSMutableAttributedString *cellAttr = [[NSMutableAttributedString alloc] init];
                        for (const auto& inNode : cell->children_) {
                            [cellAttr appendAttributedString:buildInlineAttributedString(inNode)];
                        }
                        [cellsArr addObject:cellAttr];
                    }
                    [rowsArr addObject:cellsArr];
                }
                if (rowsArr.count > 0) {
                    UIColor *tblBorderColor = !block->borderLeftColor_.empty() ? colorFromHexString(block->borderLeftColor_) : [UIColor colorWithRed:0.80 green:0.84 blue:0.88 alpha:1.0];
                    CGFloat tblBorderWidth = block->borderLeftWidth_ > 0 ? static_cast<CGFloat>(block->borderLeftWidth_) : 1.0;
                    CGFloat rowLineHeight = 38.0;

                    NSMutableParagraphStyle *innerRowPara = [[NSMutableParagraphStyle alloc] init];
                    innerRowPara.minimumLineHeight = rowLineHeight;
                    innerRowPara.maximumLineHeight = rowLineHeight;
                    innerRowPara.lineSpacing = 0;
                    innerRowPara.paragraphSpacing = 0;
                    if (block->marginTop_ > 0) innerRowPara.paragraphSpacingBefore = static_cast<CGFloat>(block->marginTop_);

                    NSDictionary *innerRowAttrs = @{
                        NSFontAttributeName: [UIFont systemFontOfSize:14.0],
                        NSForegroundColorAttributeName: [UIColor clearColor],
                        NSParagraphStyleAttributeName: innerRowPara
                    };

                    NSMutableParagraphStyle *lastRowPara = [[NSMutableParagraphStyle alloc] init];
                    lastRowPara.minimumLineHeight = rowLineHeight;
                    lastRowPara.maximumLineHeight = rowLineHeight;
                    lastRowPara.lineSpacing = 0;
                    if (rowsArr.count == 1 && block->marginTop_ > 0) {
                        lastRowPara.paragraphSpacingBefore = static_cast<CGFloat>(block->marginTop_);
                    }
                    if (block->marginBottom_ > 0) {
                        lastRowPara.paragraphSpacing = static_cast<CGFloat>(block->marginBottom_);
                    }

                    NSDictionary *lastRowAttrs = @{
                        NSFontAttributeName: [UIFont systemFontOfSize:14.0],
                        NSForegroundColorAttributeName: [UIColor clearColor],
                        NSParagraphStyleAttributeName: lastRowPara
                    };

                    NSMutableAttributedString *tblBlockAttr = [[NSMutableAttributedString alloc] init];
                    for (NSUInteger ri = 0; ri < rowsArr.count; ++ri) {
                        BOOL isLast = (ri == rowsArr.count - 1);
                        NSDictionary *attrs = isLast ? lastRowAttrs : innerRowAttrs;
                        [tblBlockAttr appendAttributedString:[[NSAttributedString alloc] initWithString:@"\u00A0" attributes:attrs]];
                        if (!isLast) {
                            [tblBlockAttr appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n" attributes:attrs]];
                        }
                    }

                    NSMutableDictionary *tblDict = [NSMutableDictionary dictionaryWithDictionary:@{
                        @"rows": rowsArr,
                        @"borderColor": tblBorderColor,
                        @"borderWidth": @(tblBorderWidth),
                        @"rowHeight": @(rowLineHeight)
                    }];
                    if (!block->backgroundColor_.empty()) {
                        UIColor *tblBg = colorFromHexString(block->backgroundColor_);
                        if (tblBg) tblDict[@"backgroundColor"] = tblBg;
                    }

                    [tblBlockAttr addAttribute:@"FastHtmlTableData"
                                         value:tblDict
                                         range:NSMakeRange(0, tblBlockAttr.length)];

                    [fullText appendAttributedString:tblBlockAttr];
                    if (i < count - 1) {
                        [fullText appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n"]];
                    }
                    continue;
                }
            }
            if ((block->type_ == "Image" || block->type_ == "Figure") && !block->url_.empty()) {
                NSString *urlStr = [NSString stringWithUTF8String:block->url_.c_str()];
                CGFloat aspect = [FastHtmlParserBridge imageAspectRatioForUrl:urlStr];
                CGFloat availW = containerWidth > 0 ? containerWidth : 360.0;
                CGFloat imgHeight = ceil(availW * aspect);
                CGFloat capHeight = !block->caption_.empty() ? 24.0 : 0.0;
                CGFloat totalH = imgHeight + capHeight;

                NSMutableParagraphStyle *imgPara = [[NSMutableParagraphStyle alloc] init];
                imgPara.minimumLineHeight = totalH;
                imgPara.maximumLineHeight = totalH;
                imgPara.lineSpacing = 0;
                if (block->marginTop_ > 0) imgPara.paragraphSpacingBefore = static_cast<CGFloat>(block->marginTop_);
                if (block->marginBottom_ > 0) {
                    imgPara.paragraphSpacing = static_cast<CGFloat>(block->marginBottom_);
                } else {
                    imgPara.paragraphSpacing = 12.0;
                }

                NSDictionary *imgAttrs = @{
                    NSFontAttributeName: [UIFont systemFontOfSize:14.0],
                    NSForegroundColorAttributeName: [UIColor clearColor],
                    NSParagraphStyleAttributeName: imgPara
                };

                NSMutableAttributedString *imgBlockAttr = [[NSMutableAttributedString alloc] initWithString:@"\u00A0" attributes:imgAttrs];

                NSString *altStr = [NSString stringWithUTF8String:block->alt_.c_str()];
                NSString *capStr = [NSString stringWithUTF8String:block->caption_.c_str()];

                [imgBlockAttr addAttribute:@"FastHtmlImageData"
                                     value:@{
                                         @"url": urlStr,
                                         @"alt": altStr,
                                         @"caption": capStr,
                                         @"imageHeight": @(imgHeight),
                                         @"captionHeight": @(capHeight),
                                         @"totalHeight": @(totalH),
                                         @"aspectRatio": @(aspect),
                                         @"borderRadius": @(block->borderRadius_)
                                     }
                                     range:NSMakeRange(0, imgBlockAttr.length)];

                [fullText appendAttributedString:imgBlockAttr];
                if (i < count - 1) {
                    [fullText appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n"]];
                }
                continue;
            }
            [fullText appendAttributedString:blockAttr];
        }
    }

    return fullText;
}

@end
