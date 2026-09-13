#include "HybridFastHtmlParser.hpp"

#include <lexbor/html/parser.h>
#include <lexbor/html/interfaces/document.h>
#include <lexbor/dom/interfaces/node.h>
#include <lexbor/dom/interfaces/element.h>
#include <lexbor/tag/const.h>
#include <lexbor/html/serialize.h>

#include <cstring>
#include <vector>
#include <string>
#include <functional>
#include <algorithm>
#include <mutex>
#include <list>
#include <unordered_map>
#include <sstream>
#include <cctype>

namespace margelo::nitro::fasthtmlparser {

// ── Lexbor Native HTML Serialization Helper ──────────────────────────────────
static lxb_status_t lexborSerializeCb(const lxb_char_t *data, size_t len, void *ctx) {
    auto* out = static_cast<std::string*>(ctx);
    out->append(reinterpret_cast<const char*>(data), len);
    return LXB_STATUS_OK;
}

static std::string serializeNodeHtml(lxb_dom_node_t* node) {
    if (!node) return "";
    std::string html;
    lxb_html_serialize_deep_cb(node, lexborSerializeCb, &html);
    return html;
}


std::string HybridContentBlock::getHtml() {
    return html_;
}

// ── Lexbor DOM Parsing Helpers ────────────────────────────────────────────────
static std::string getAttribute(lxb_dom_element_t* element, const char* name) {
    if (!element) return "";
    size_t val_len = 0;
    const lxb_char_t* val = lxb_dom_element_get_attribute(
        element,
        reinterpret_cast<const lxb_char_t*>(name),
        std::strlen(name),
        &val_len
    );
    if (val && val_len > 0) {
        return std::string(reinterpret_cast<const char*>(val), val_len);
    }
    return "";
}

static std::string getNodeTagName(lxb_dom_node_t* node) {
    if (!node) return "";
    size_t len = 0;
    const lxb_char_t* name = lxb_dom_node_name(node, &len);
    if (name && len > 0) {
        return std::string(reinterpret_cast<const char*>(name), len);
    }
    return "";
}

static std::string getNodeText(lxb_dom_node_t* node) {
    if (!node) return "";
    size_t len = 0;
    lxb_char_t* text = lxb_dom_node_text_content(node, &len);
    std::string result = (text && len > 0) ? std::string(reinterpret_cast<const char*>(text), len) : "";
    if (text && node->owner_document) {
        lxb_dom_document_destroy_text(node->owner_document, text);
    }
    return result;
}

// ── Style Context & Tag Style Resolver ───────────────────────────────────────
struct StyleContext {
    double fontSize{16.0};
    std::string color{"#000000"};
    std::string backgroundColor{""};
    std::string fontFamily{""};
    std::string fontWeight{"normal"};
    std::string fontStyle{"normal"};
    double lineHeight{0.0};
    double letterSpacing{0.0};
    std::string textTransform{""};
    std::string textAlign{""};
    double opacity{1.0};
    std::string fontFeatureSettings{""};
};

static std::string normalizeHtmlWhitespace(const std::string& input) {
    if (input.empty()) return "";
    std::string result;
    result.reserve(input.size());
    bool inWhitespace = false;
    for (char ch : input) {
        if (ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r') {
            if (!inWhitespace) {
                result.push_back(' ');
                inWhitespace = true;
            }
        } else {
            result.push_back(ch);
            inWhitespace = false;
        }
    }
    return result;
}

static std::string applyTextTransform(const std::string& input, const std::string& transform) {
    if (transform.empty() || input.empty()) return input;
    std::string result = input;
    if (transform == "uppercase") {
        std::transform(result.begin(), result.end(), result.begin(), ::toupper);
    } else if (transform == "lowercase") {
        std::transform(result.begin(), result.end(), result.begin(), ::tolower);
    } else if (transform == "capitalize") {
        bool capNext = true;
        for (size_t i = 0; i < result.size(); ++i) {
            if (isspace(result[i])) {
                capNext = true;
            } else if (capNext && isalpha(result[i])) {
                result[i] = toupper(result[i]);
                capNext = false;
            }
        }
    }
    return result;
}

static inline std::string trimSpacesOnly(const std::string& str) {
    size_t start = 0;
    while (start < str.size() && std::isspace(static_cast<unsigned char>(str[start]))) start++;
    size_t end = str.size();
    while (end > start && std::isspace(static_cast<unsigned char>(str[end - 1]))) end--;
    return str.substr(start, end - start);
}

static inline std::string cleanQuotes(const std::string& str) {
    if (str.size() >= 2) {
        if ((str.front() == '\'' && str.back() == '\'') ||
            (str.front() == '"' && str.back() == '"')) {
            return str.substr(1, str.size() - 2);
        }
    }
    return str;
}

static double parseCssDimension(const std::string& raw, double baseFontSize = 16.0) {
    std::string val = trimSpacesOnly(raw);
    if (val.empty()) return 0.0;

    size_t imp = val.find('!');
    if (imp != std::string::npos) val = trimSpacesOnly(val.substr(0, imp));

    try {
        if (val.size() > 2 && (val.rfind("px") == val.size() - 2 || val.rfind("PX") == val.size() - 2)) {
            return std::stod(val.substr(0, val.size() - 2));
        }
        if (val.size() > 2 && (val.rfind("pt") == val.size() - 2 || val.rfind("PT") == val.size() - 2)) {
            return std::stod(val.substr(0, val.size() - 2)) * 1.333333;
        }
        if (val.size() > 2 && (val.rfind("em") == val.size() - 2 || val.rfind("EM") == val.size() - 2)) {
            return std::stod(val.substr(0, val.size() - 2)) * baseFontSize;
        }
        if (val.size() > 3 && (val.rfind("rem") == val.size() - 3 || val.rfind("REM") == val.size() - 3)) {
            return std::stod(val.substr(0, val.size() - 3)) * 16.0;
        }
        if (val.back() == '%') {
            return (std::stod(val.substr(0, val.size() - 1)) / 100.0) * baseFontSize;
        }
        return std::stod(val);
    } catch (...) {
        return 0.0;
    }
}

static std::string parseCssColor(const std::string& raw) {
    std::string val = trimSpacesOnly(raw);
    if (val.empty()) return "";

    size_t imp = val.find('!');
    if (imp != std::string::npos) val = trimSpacesOnly(val.substr(0, imp));

    std::string lower = val;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);

    // ── Complete Standard W3C CSS Named Colors (148 Colors) ─────────────────
    static const std::unordered_map<std::string, const char*> kNamedCssColors = {
        {"transparent", "transparent"},
        {"aliceblue", "#F0F8FF"},
        {"antiquewhite", "#FAEBD7"},
        {"aqua", "#00FFFF"},
        {"aquamarine", "#7FFFD4"},
        {"azure", "#F0FFFF"},
        {"beige", "#F5F5DC"},
        {"bisque", "#FFE4C4"},
        {"black", "#000000"},
        {"blanchedalmond", "#FFEBCD"},
        {"blue", "#0000FF"},
        {"blueviolet", "#8A2BE2"},
        {"brown", "#A52A2A"},
        {"burlywood", "#DEB887"},
        {"cadetblue", "#5F9EA0"},
        {"chartreuse", "#7FFF00"},
        {"chocolate", "#D2691E"},
        {"coral", "#FF7F50"},
        {"cornflowerblue", "#6495ED"},
        {"cornsilk", "#FFF8DC"},
        {"crimson", "#DC143C"},
        {"cyan", "#00FFFF"},
        {"darkblue", "#00008B"},
        {"darkcyan", "#008B8B"},
        {"darkgoldenrod", "#B8860B"},
        {"darkgray", "#A9A9A9"},
        {"darkgrey", "#A9A9A9"},
        {"darkgreen", "#006400"},
        {"darkkhaki", "#BDB76B"},
        {"darkmagenta", "#8B008B"},
        {"darkolivegreen", "#556B2F"},
        {"darkorange", "#FF8C00"},
        {"darkorchid", "#9932CC"},
        {"darkred", "#8B0000"},
        {"darksalmon", "#E9967A"},
        {"darkseagreen", "#8FBC8F"},
        {"darkslateblue", "#483D8B"},
        {"darkslategray", "#2F4F4F"},
        {"darkslategrey", "#2F4F4F"},
        {"darkturquoise", "#00CED1"},
        {"darkviolet", "#9400D3"},
        {"deeppink", "#FF1493"},
        {"deepskyblue", "#00BFFF"},
        {"dimgray", "#696969"},
        {"dimgrey", "#696969"},
        {"dodgerblue", "#1E90FF"},
        {"firebrick", "#B22222"},
        {"floralwhite", "#FFFAF0"},
        {"forestgreen", "#228B22"},
        {"fuchsia", "#FF00FF"},
        {"gainsboro", "#DCDCDC"},
        {"ghostwhite", "#F8F8FF"},
        {"gold", "#FFD700"},
        {"goldenrod", "#DAA520"},
        {"gray", "#808080"},
        {"grey", "#808080"},
        {"green", "#008000"},
        {"greenyellow", "#ADFF2F"},
        {"honeydew", "#F0FFF0"},
        {"hotpink", "#FF69B4"},
        {"indianred", "#CD5C5C"},
        {"indigo", "#4B0082"},
        {"ivory", "#FFFFF0"},
        {"khaki", "#F0E68C"},
        {"lavender", "#E6E6FA"},
        {"lavenderblush", "#FFF0F5"},
        {"lawngreen", "#7CFC00"},
        {"lemonchiffon", "#FFFACD"},
        {"lightblue", "#ADD8E6"},
        {"lightcoral", "#F08080"},
        {"lightcyan", "#E0FFFF"},
        {"lightgoldenrodyellow", "#FAFAD2"},
        {"lightgray", "#D3D3D3"},
        {"lightgrey", "#D3D3D3"},
        {"lightgreen", "#90EE90"},
        {"lightpink", "#FFB6C1"},
        {"lightsalmon", "#FFA07A"},
        {"lightseagreen", "#20B2AA"},
        {"lightskyblue", "#87CEFA"},
        {"lightslategray", "#778899"},
        {"lightslategrey", "#778899"},
        {"lightsteelblue", "#B0C4DE"},
        {"lightyellow", "#FFFFE0"},
        {"lime", "#00FF00"},
        {"limegreen", "#32CD32"},
        {"linen", "#FAF0E6"},
        {"magenta", "#FF00FF"},
        {"maroon", "#800000"},
        {"mediumaquamarine", "#66CDAA"},
        {"mediumblue", "#0000CD"},
        {"mediumorchid", "#BA55D3"},
        {"mediumpurple", "#9370DB"},
        {"mediumseagreen", "#3CB371"},
        {"mediumslateblue", "#7B68EE"},
        {"mediumspringgreen", "#00FA9A"},
        {"mediumturquoise", "#48D1CC"},
        {"mediumvioletred", "#C71585"},
        {"midnightblue", "#191970"},
        {"mintcream", "#F5FFFA"},
        {"mistyrose", "#FFE4E1"},
        {"moccasin", "#FFE4B5"},
        {"navajowhite", "#FFDEAD"},
        {"navy", "#000080"},
        {"oldlace", "#FDF5E6"},
        {"olive", "#808000"},
        {"olivedrab", "#6B8E23"},
        {"orange", "#FFA500"},
        {"orangered", "#FF4500"},
        {"orchid", "#DA70D6"},
        {"palegoldenrod", "#EEE8AA"},
        {"palegreen", "#98FB98"},
        {"paleturquoise", "#AFEEEE"},
        {"palevioletred", "#DB7093"},
        {"papayawhip", "#FFEFD5"},
        {"peachpuff", "#FFDAB9"},
        {"peru", "#CD853F"},
        {"pink", "#FFC0CB"},
        {"plum", "#DDA0DD"},
        {"powderblue", "#B0E0E6"},
        {"purple", "#800080"},
        {"rebeccapurple", "#663399"},
        {"red", "#FF0000"},
        {"rosybrown", "#BC8F8F"},
        {"royalblue", "#4169E1"},
        {"saddlebrown", "#8B4513"},
        {"salmon", "#FA8072"},
        {"sandybrown", "#F4A460"},
        {"seagreen", "#2E8B57"},
        {"seashell", "#FFF5EE"},
        {"sienna", "#A0522D"},
        {"silver", "#C0C0C0"},
        {"skyblue", "#87CEEB"},
        {"slateblue", "#6A5ACD"},
        {"slategray", "#708090"},
        {"slategrey", "#708090"},
        {"snow", "#FFFAFA"},
        {"springgreen", "#00FF7F"},
        {"steelblue", "#4682B4"},
        {"tan", "#D2B48C"},
        {"teal", "#008080"},
        {"thistle", "#D8BFD8"},
        {"tomato", "#FF6347"},
        {"turquoise", "#40E0D0"},
        {"violet", "#EE82EE"},
        {"wheat", "#F5DEB3"},
        {"white", "#FFFFFF"},
        {"whitesmoke", "#F5F5F5"},
        {"yellow", "#FFFF00"},
        {"yellowgreen", "#9ACD32"}
    };

    auto it = kNamedCssColors.find(lower);
    if (it != kNamedCssColors.end()) {
        return std::string(it->second);
    }

    // ── Hex Colors (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) ────────────────────────
    if (val.front() == '#') {
        if (val.size() == 4) { // #RGB -> #RRGGBB
            std::string full = "#";
            full += val[1]; full += val[1];
            full += val[2]; full += val[2];
            full += val[3]; full += val[3];
            return full;
        } else if (val.size() == 5) { // #RGBA -> #AARRGGBB
            std::string full = "#";
            full += val[4]; full += val[4];
            full += val[1]; full += val[1];
            full += val[2]; full += val[2];
            full += val[3]; full += val[3];
            return full;
        } else if (val.size() == 9) { // #RRGGBBAA -> #AARRGGBB
            std::string full = "#";
            full += val.substr(7, 2); // AA
            full += val.substr(1, 6); // RRGGBB
            return full;
        }
        return val;
    }

    // ── rgb(...) or rgba(...) ───────────────────────────────────────────────
    if (lower.rfind("rgb", 0) == 0) {
        size_t openP = val.find('(');
        size_t closeP = val.find(')');
        if (openP != std::string::npos && closeP != std::string::npos && closeP > openP) {
            std::string inside = val.substr(openP + 1, closeP - openP - 1);
            std::vector<std::string> parts;
            std::stringstream ss(inside);
            std::string item;
            while (std::getline(ss, item, ',')) {
                parts.push_back(trimSpacesOnly(item));
            }
            if (parts.size() >= 3) {
                try {
                    int r = std::clamp(std::stoi(parts[0]), 0, 255);
                    int g = std::clamp(std::stoi(parts[1]), 0, 255);
                    int b = std::clamp(std::stoi(parts[2]), 0, 255);
                    char buf[12];
                    if (parts.size() >= 4) {
                        double a = std::clamp(std::stod(parts[3]), 0.0, 1.0);
                        int aInt = static_cast<int>(a * 255.0);
                        snprintf(buf, sizeof(buf), "#%02X%02X%02X%02X", aInt, r, g, b);
                    } else {
                        snprintf(buf, sizeof(buf), "#%02X%02X%02X", r, g, b);
                    }
                    return std::string(buf);
                } catch (...) {}
            }
        }
    }

    // ── hsl(...) or hsla(...) ───────────────────────────────────────────────
    if (lower.rfind("hsl", 0) == 0) {
        size_t openP = val.find('(');
        size_t closeP = val.find(')');
        if (openP != std::string::npos && closeP != std::string::npos && closeP > openP) {
            std::string inside = val.substr(openP + 1, closeP - openP - 1);
            std::vector<std::string> parts;
            std::stringstream ss(inside);
            std::string item;
            while (std::getline(ss, item, ',')) {
                parts.push_back(trimSpacesOnly(item));
            }
            if (parts.size() >= 3) {
                try {
                    double h = std::stod(parts[0]);
                    std::string sStr = parts[1];
                    if (!sStr.empty() && sStr.back() == '%') sStr.pop_back();
                    double s = std::stod(sStr) / 100.0;
                    std::string lStr = parts[2];
                    if (!lStr.empty() && lStr.back() == '%') lStr.pop_back();
                    double l = std::stod(lStr) / 100.0;
                    double a = 1.0;
                    if (parts.size() >= 4) {
                        a = std::clamp(std::stod(parts[3]), 0.0, 1.0);
                    }

                    auto hue2rgb = [](double p, double q, double t) {
                        if (t < 0.0) t += 1.0;
                        if (t > 1.0) t -= 1.0;
                        if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
                        if (t < 1.0 / 2.0) return q;
                        if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
                        return p;
                    };

                    double r, g, b;
                    if (s == 0.0) {
                        r = g = b = l;
                    } else {
                        double q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
                        double p = 2.0 * l - q;
                        r = hue2rgb(p, q, (h / 360.0) + (1.0 / 3.0));
                        g = hue2rgb(p, q, h / 360.0);
                        b = hue2rgb(p, q, (h / 360.0) - (1.0 / 3.0));
                    }

                    int rInt = std::clamp(static_cast<int>(r * 255.0 + 0.5), 0, 255);
                    int gInt = std::clamp(static_cast<int>(g * 255.0 + 0.5), 0, 255);
                    int bInt = std::clamp(static_cast<int>(b * 255.0 + 0.5), 0, 255);
                    char buf[12];
                    if (a < 1.0) {
                        int aInt = std::clamp(static_cast<int>(a * 255.0 + 0.5), 0, 255);
                        snprintf(buf, sizeof(buf), "#%02X%02X%02X%02X", aInt, rInt, gInt, bInt);
                    } else {
                        snprintf(buf, sizeof(buf), "#%02X%02X%02X", rInt, gInt, bInt);
                    }
                    return std::string(buf);
                } catch (...) {}
            }
        }
    }

    return val;
}

static std::string parseCssFontFamily(const std::string& raw) {
    std::string val = trimSpacesOnly(raw);
    if (val.empty()) return "";
    size_t imp = val.find('!');
    if (imp != std::string::npos) val = trimSpacesOnly(val.substr(0, imp));

    std::stringstream ss(val);
    std::string item;
    std::string result;
    while (std::getline(ss, item, ',')) {
        std::string cleaned = cleanQuotes(trimSpacesOnly(item));
        if (!cleaned.empty()) {
            if (!result.empty()) result += ", ";
            result += cleaned;
        }
    }
    return result.empty() ? cleanQuotes(val) : result;
}

static void parseInlineCss(
    const std::string& styleAttr,
    NativeTextStyle& outStyle,
    double baseFontSize = 16.0
) {
    if (styleAttr.empty()) return;

    std::stringstream ss(styleAttr);
    std::string decl;
    while (std::getline(ss, decl, ';')) {
        decl = trimSpacesOnly(decl);
        if (decl.empty()) continue;

        size_t colon = decl.find(':');
        if (colon == std::string::npos) continue;

        std::string prop = trimSpacesOnly(decl.substr(0, colon));
        std::string val = trimSpacesOnly(decl.substr(colon + 1));
        if (prop.empty() || val.empty()) continue;

        std::transform(prop.begin(), prop.end(), prop.begin(), ::tolower);

        if (prop == "font-family") {
            outStyle.fontFamily = parseCssFontFamily(val);
        } else if (prop == "font-size") {
            double sz = parseCssDimension(val, baseFontSize);
            if (sz > 0) outStyle.fontSize = sz;
        } else if (prop == "font-weight") {
            std::string w = trimSpacesOnly(val);
            std::string lowerW = w;
            std::transform(lowerW.begin(), lowerW.end(), lowerW.begin(), ::tolower);
            if (lowerW == "bold" || lowerW == "bolder") outStyle.fontWeight = "bold";
            else if (lowerW == "normal" || lowerW == "regular") outStyle.fontWeight = "normal";
            else outStyle.fontWeight = w;
        } else if (prop == "font-style") {
            outStyle.fontStyle = trimSpacesOnly(val);
        } else if (prop == "color") {
            outStyle.color = parseCssColor(val);
        } else if (prop == "background-color" || prop == "background") {
            outStyle.backgroundColor = parseCssColor(val);
        } else if (prop == "line-height") {
            double lh = parseCssDimension(val, baseFontSize);
            if (lh > 0) outStyle.lineHeight = lh;
        } else if (prop == "letter-spacing") {
            outStyle.letterSpacing = parseCssDimension(val, baseFontSize);
        } else if (prop == "text-align") {
            outStyle.textAlign = trimSpacesOnly(val);
        } else if (prop == "text-transform") {
            outStyle.textTransform = trimSpacesOnly(val);
        } else if (prop == "text-decoration" || prop == "text-decoration-line") {
            outStyle.textDecorationLine = trimSpacesOnly(val);
        } else if (prop == "text-decoration-color") {
            outStyle.textDecorationColor = parseCssColor(val);
        } else if (prop == "text-decoration-style") {
            outStyle.textDecorationStyle = trimSpacesOnly(val);
        } else if (prop == "text-indent") {
            outStyle.textIndent = parseCssDimension(val, baseFontSize);
        } else if (prop == "opacity") {
            try { outStyle.opacity = std::stod(val); } catch (...) {}
        } else if (prop == "font-feature-settings") {
            outStyle.fontFeatureSettings = trimSpacesOnly(val);
        } else if (prop == "margin") {
            outStyle.margin = parseCssDimension(val, baseFontSize);
        } else if (prop == "margin-top") {
            outStyle.marginTop = parseCssDimension(val, baseFontSize);
        } else if (prop == "margin-bottom") {
            outStyle.marginBottom = parseCssDimension(val, baseFontSize);
        } else if (prop == "margin-left") {
            outStyle.marginLeft = parseCssDimension(val, baseFontSize);
        } else if (prop == "margin-right") {
            outStyle.marginRight = parseCssDimension(val, baseFontSize);
        } else if (prop == "padding") {
            outStyle.padding = parseCssDimension(val, baseFontSize);
        } else if (prop == "padding-top") {
            outStyle.paddingTop = parseCssDimension(val, baseFontSize);
        } else if (prop == "padding-bottom") {
            outStyle.paddingBottom = parseCssDimension(val, baseFontSize);
        } else if (prop == "padding-left") {
            outStyle.paddingLeft = parseCssDimension(val, baseFontSize);
        } else if (prop == "padding-right") {
            outStyle.paddingRight = parseCssDimension(val, baseFontSize);
        } else if (prop == "border-width" || prop == "border-left-width") {
            outStyle.borderLeftWidth = parseCssDimension(val, baseFontSize);
        } else if (prop == "border-color" || prop == "border-left-color") {
            outStyle.borderLeftColor = parseCssColor(val);
        } else if (prop == "border-radius") {
            outStyle.borderRadius = parseCssDimension(val, baseFontSize);
        }
    }
}

static const NativeTextStyle* findTagStyle(
    const std::string& tag,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    if (!tagsStyles.has_value()) return nullptr;
    const auto& map = tagsStyles.value();
    std::string lowerTag = tag;
    std::transform(lowerTag.begin(), lowerTag.end(), lowerTag.begin(), ::tolower);
    auto it = map.find(lowerTag);
    if (it != map.end()) return &it->second;
    it = map.find(tag);
    if (it != map.end()) return &it->second;
    return nullptr;
}

static void applyBlockOverrides(
    HybridContentBlock* block,
    const NativeTextStyle* overrideStyle,
    StyleContext& ctx
) {
    if (!overrideStyle) return;
    if (block) {
        if (overrideStyle->fontSize.has_value() && overrideStyle->fontSize.value() > 0) block->fontSize_ = overrideStyle->fontSize.value();
        if (overrideStyle->color.has_value() && !overrideStyle->color.value().empty()) block->color_ = overrideStyle->color.value();
        if (overrideStyle->backgroundColor.has_value() && !overrideStyle->backgroundColor.value().empty()) block->backgroundColor_ = overrideStyle->backgroundColor.value();
        if (overrideStyle->fontFamily.has_value() && !overrideStyle->fontFamily.value().empty()) block->fontFamily_ = overrideStyle->fontFamily.value();
        if (overrideStyle->fontWeight.has_value() && !overrideStyle->fontWeight.value().empty()) block->fontWeight_ = overrideStyle->fontWeight.value();
        if (overrideStyle->fontStyle.has_value() && !overrideStyle->fontStyle.value().empty()) block->fontStyle_ = overrideStyle->fontStyle.value();
        if (overrideStyle->lineHeight.has_value() && overrideStyle->lineHeight.value() > 0) block->lineHeight_ = overrideStyle->lineHeight.value();
        // Margin resolution (Specific > Directional > Standalone)
        if (overrideStyle->margin.has_value()) {
            block->marginTop_ = overrideStyle->margin.value();
            block->marginBottom_ = overrideStyle->margin.value();
            block->marginLeft_ = overrideStyle->margin.value();
            block->marginRight_ = overrideStyle->margin.value();
        }
        if (overrideStyle->marginVertical.has_value()) {
            block->marginTop_ = overrideStyle->marginVertical.value();
            block->marginBottom_ = overrideStyle->marginVertical.value();
        }
        if (overrideStyle->marginHorizontal.has_value()) {
            block->marginLeft_ = overrideStyle->marginHorizontal.value();
            block->marginRight_ = overrideStyle->marginHorizontal.value();
        }
        if (overrideStyle->marginTop.has_value()) block->marginTop_ = overrideStyle->marginTop.value();
        if (overrideStyle->marginBottom.has_value()) block->marginBottom_ = overrideStyle->marginBottom.value();
        if (overrideStyle->marginLeft.has_value()) block->marginLeft_ = overrideStyle->marginLeft.value();
        if (overrideStyle->marginRight.has_value()) block->marginRight_ = overrideStyle->marginRight.value();

        // Padding resolution (Specific > Directional > Standalone)
        if (overrideStyle->padding.has_value()) {
            block->paddingTop_ = overrideStyle->padding.value();
            block->paddingBottom_ = overrideStyle->padding.value();
            block->paddingLeft_ = overrideStyle->padding.value();
            block->paddingRight_ = overrideStyle->padding.value();
        }
        if (overrideStyle->paddingVertical.has_value()) {
            block->paddingTop_ = overrideStyle->paddingVertical.value();
            block->paddingBottom_ = overrideStyle->paddingVertical.value();
        }
        if (overrideStyle->paddingHorizontal.has_value()) {
            block->paddingLeft_ = overrideStyle->paddingHorizontal.value();
            block->paddingRight_ = overrideStyle->paddingHorizontal.value();
        }
        if (overrideStyle->paddingTop.has_value()) block->paddingTop_ = overrideStyle->paddingTop.value();
        if (overrideStyle->paddingBottom.has_value()) block->paddingBottom_ = overrideStyle->paddingBottom.value();
        if (overrideStyle->paddingLeft.has_value()) block->paddingLeft_ = overrideStyle->paddingLeft.value();
        if (overrideStyle->paddingRight.has_value()) block->paddingRight_ = overrideStyle->paddingRight.value();

        // Border resolution (Specific > Standalone)
        if (overrideStyle->borderWidth.has_value()) block->borderLeftWidth_ = overrideStyle->borderWidth.value();
        if (overrideStyle->borderColor.has_value() && !overrideStyle->borderColor.value().empty()) block->borderLeftColor_ = overrideStyle->borderColor.value();
        if (overrideStyle->borderLeftWidth.has_value()) block->borderLeftWidth_ = overrideStyle->borderLeftWidth.value();
        if (overrideStyle->borderLeftColor.has_value() && !overrideStyle->borderLeftColor.value().empty()) block->borderLeftColor_ = overrideStyle->borderLeftColor.value();
        if (overrideStyle->borderRadius.has_value()) block->borderRadius_ = overrideStyle->borderRadius.value();

        if (overrideStyle->textAlign.has_value()) block->textAlign_ = overrideStyle->textAlign.value();
        if (overrideStyle->textTransform.has_value()) block->textTransform_ = overrideStyle->textTransform.value();
        if (overrideStyle->textIndent.has_value()) block->textIndent_ = overrideStyle->textIndent.value();
        if (overrideStyle->letterSpacing.has_value()) block->letterSpacing_ = overrideStyle->letterSpacing.value();
        if (overrideStyle->opacity.has_value()) block->opacity_ = overrideStyle->opacity.value();
        if (overrideStyle->fontFeatureSettings.has_value() && !overrideStyle->fontFeatureSettings.value().empty()) block->fontFeatureSettings_ = overrideStyle->fontFeatureSettings.value();
    }

    if (overrideStyle->fontSize.has_value() && overrideStyle->fontSize.value() > 0) ctx.fontSize = overrideStyle->fontSize.value();
    if (overrideStyle->color.has_value() && !overrideStyle->color.value().empty()) ctx.color = overrideStyle->color.value();
    if (overrideStyle->backgroundColor.has_value() && !overrideStyle->backgroundColor.value().empty()) ctx.backgroundColor = overrideStyle->backgroundColor.value();
    if (overrideStyle->fontFamily.has_value() && !overrideStyle->fontFamily.value().empty()) ctx.fontFamily = overrideStyle->fontFamily.value();
    if (overrideStyle->fontWeight.has_value() && !overrideStyle->fontWeight.value().empty()) ctx.fontWeight = overrideStyle->fontWeight.value();
    if (overrideStyle->fontStyle.has_value() && !overrideStyle->fontStyle.value().empty()) ctx.fontStyle = overrideStyle->fontStyle.value();
    if (overrideStyle->lineHeight.has_value() && overrideStyle->lineHeight.value() > 0) ctx.lineHeight = overrideStyle->lineHeight.value();
    if (overrideStyle->letterSpacing.has_value()) ctx.letterSpacing = overrideStyle->letterSpacing.value();
    if (overrideStyle->textTransform.has_value()) ctx.textTransform = overrideStyle->textTransform.value();
    if (overrideStyle->textAlign.has_value()) ctx.textAlign = overrideStyle->textAlign.value();
    if (overrideStyle->opacity.has_value()) ctx.opacity = overrideStyle->opacity.value();
    if (overrideStyle->fontFeatureSettings.has_value() && !overrideStyle->fontFeatureSettings.value().empty()) ctx.fontFeatureSettings = overrideStyle->fontFeatureSettings.value();
}

static void applyNodeStyling(
    HybridContentBlock* block,
    lxb_dom_element_t* elem,
    const std::string& tagName,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles,
    StyleContext& ctx
) {
    // Tier 2: Apply tagStyle override (mid priority)
    const NativeTextStyle* tagOverride = findTagStyle(tagName, tagsStyles);
    if (tagOverride) {
        applyBlockOverrides(block, tagOverride, ctx);
    }

    // Tier 3: Apply inline style="..." attribute (highest priority)
    if (elem) {
        std::string styleAttr = getAttribute(elem, "style");
        if (!styleAttr.empty()) {
            NativeTextStyle inlineStyle;
            parseInlineCss(styleAttr, inlineStyle, ctx.fontSize);
            applyBlockOverrides(block, &inlineStyle, ctx);
        }
    }
}

static std::shared_ptr<HybridInlineNode> parseInlineNode(
    lxb_dom_node_t* node,
    const StyleContext& parentCtx,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    if (!node) return nullptr;

    if (node->type == LXB_DOM_NODE_TYPE_TEXT) {
        std::string str = getNodeText(node);
        if (str.empty()) return nullptr;
        str = normalizeHtmlWhitespace(str);
        str = applyTextTransform(str, parentCtx.textTransform);
        auto textNode = std::make_shared<HybridInlineNode>("Text", str, "");
        textNode->fontSize_ = parentCtx.fontSize;
        textNode->color_ = parentCtx.color;
        textNode->backgroundColor_ = parentCtx.backgroundColor;
        textNode->fontFamily_ = parentCtx.fontFamily;
        textNode->fontWeight_ = parentCtx.fontWeight;
        textNode->fontStyle_ = parentCtx.fontStyle;
        textNode->letterSpacing_ = parentCtx.letterSpacing;
        textNode->textTransform_ = parentCtx.textTransform;
        textNode->opacity_ = parentCtx.opacity;
        textNode->fontFeatureSettings_ = parentCtx.fontFeatureSettings;
        return textNode;
    }

    if (node->type == LXB_DOM_NODE_TYPE_ELEMENT) {
        lxb_tag_id_t tagId = lxb_dom_node_tag_id(node);
        lxb_dom_element_t* elem = lxb_dom_interface_element(node);

        // Skip non-rendered inline elements
        if (tagId == LXB_TAG_SCRIPT || tagId == LXB_TAG_STYLE) {
            return nullptr;
        }

        std::string type = "Span";
        std::string url = "";
        double fontSize = parentCtx.fontSize;
        std::string color = parentCtx.color;
        std::string backgroundColor = parentCtx.backgroundColor;
        std::string fontFamily = parentCtx.fontFamily;
        std::string fontWeight = parentCtx.fontWeight;
        std::string fontStyle = parentCtx.fontStyle;
        double letterSpacing = parentCtx.letterSpacing;
        std::string textTransform = parentCtx.textTransform;
        std::string textDecColor = "";
        std::string textDecStyle = "";
        double opacity = parentCtx.opacity;
        std::string fontFeatureSettings = parentCtx.fontFeatureSettings;
        bool isUnderline = false;
        bool isStrikethrough = false;
        bool isLink = false;
        double baselineShift = 0.0;
        std::string tagName = getNodeTagName(node);

        switch (tagId) {
            case LXB_TAG_B:
            case LXB_TAG_STRONG:
                type = "Bold";
                fontWeight = "bold";
                break;
            case LXB_TAG_I:
            case LXB_TAG_EM:
            case LXB_TAG_CITE:
            case LXB_TAG_VAR:
            case LXB_TAG_ADDRESS:
                type = "Italic";
                fontStyle = "italic";
                break;
            case LXB_TAG_A:
                type = "Link";
                url = getAttribute(elem, "href");
                color = "";
                isUnderline = true;
                isLink = true;
                break;
            case LXB_TAG_CODE:
            case LXB_TAG_KBD:
            case LXB_TAG_SAMP:
            case LXB_TAG_TT:
                type = "Code";
                fontFamily = "monospace";
                fontSize = parentCtx.fontSize * 0.9;
                backgroundColor = "#F1F5F9";
                color = "#0F172A";
                break;
            case LXB_TAG_S:
            case LXB_TAG_STRIKE:
            case LXB_TAG_DEL:
                type = "Strikethrough";
                isStrikethrough = true;
                color = "#64748B";
                break;
            case LXB_TAG_U:
            case LXB_TAG_INS:
                type = "Underline";
                isUnderline = true;
                break;
            case LXB_TAG_SUP:
                type = "Superscript";
                fontSize = parentCtx.fontSize * 0.75;
                baselineShift = 6.0;
                break;
            case LXB_TAG_SUB:
                type = "Subscript";
                fontSize = parentCtx.fontSize * 0.75;
                baselineShift = -4.0;
                break;
            case LXB_TAG_MARK:
                type = "Mark";
                backgroundColor = "#FEF08A";
                color = "#854D0E";
                break;
            case LXB_TAG_SMALL:
                type = "Small";
                fontSize = parentCtx.fontSize * 0.85;
                color = "#64748B";
                break;
            case LXB_TAG_BR:
            case LXB_TAG_WBR:
                return std::make_shared<HybridInlineNode>("Break", "", "");
            default:
                type = "Span";
                break;
        }

        // Tier 2: Apply user tagStyle overrides if defined
        const NativeTextStyle* tagOverride = findTagStyle(tagName, tagsStyles);
        if (tagOverride) {
            if (tagOverride->fontSize.has_value() && tagOverride->fontSize.value() > 0) fontSize = tagOverride->fontSize.value();
            if (tagOverride->color.has_value() && !tagOverride->color.value().empty()) color = tagOverride->color.value();
            if (tagOverride->backgroundColor.has_value() && !tagOverride->backgroundColor.value().empty()) backgroundColor = tagOverride->backgroundColor.value();
            if (tagOverride->fontFamily.has_value() && !tagOverride->fontFamily.value().empty()) fontFamily = tagOverride->fontFamily.value();
            if (tagOverride->fontWeight.has_value() && !tagOverride->fontWeight.value().empty()) fontWeight = tagOverride->fontWeight.value();
            if (tagOverride->fontStyle.has_value() && !tagOverride->fontStyle.value().empty()) fontStyle = tagOverride->fontStyle.value();
            if (tagOverride->letterSpacing.has_value()) letterSpacing = tagOverride->letterSpacing.value();
            if (tagOverride->textTransform.has_value()) textTransform = tagOverride->textTransform.value();
            if (tagOverride->textDecorationColor.has_value()) textDecColor = tagOverride->textDecorationColor.value();
            if (tagOverride->textDecorationStyle.has_value()) textDecStyle = tagOverride->textDecorationStyle.value();
            if (tagOverride->opacity.has_value()) opacity = tagOverride->opacity.value();
            if (tagOverride->fontFeatureSettings.has_value() && !tagOverride->fontFeatureSettings.value().empty()) fontFeatureSettings = tagOverride->fontFeatureSettings.value();
            if (tagOverride->textDecorationLine.has_value()) {
                std::string line = tagOverride->textDecorationLine.value();
                if (line.find("underline") != std::string::npos) isUnderline = true;
                if (line.find("line-through") != std::string::npos) isStrikethrough = true;
                if (line == "none") { isUnderline = false; isStrikethrough = false; }
            }
        }

        // Tier 3: Apply inline style="..." attribute (highest priority)
        if (elem) {
            std::string styleAttr = getAttribute(elem, "style");
            if (!styleAttr.empty()) {
                NativeTextStyle inlineOverride;
                parseInlineCss(styleAttr, inlineOverride, fontSize);
                if (inlineOverride.fontSize.has_value() && inlineOverride.fontSize.value() > 0) fontSize = inlineOverride.fontSize.value();
                if (inlineOverride.color.has_value() && !inlineOverride.color.value().empty()) color = inlineOverride.color.value();
                if (inlineOverride.backgroundColor.has_value() && !inlineOverride.backgroundColor.value().empty()) backgroundColor = inlineOverride.backgroundColor.value();
                if (inlineOverride.fontFamily.has_value() && !inlineOverride.fontFamily.value().empty()) fontFamily = inlineOverride.fontFamily.value();
                if (inlineOverride.fontWeight.has_value() && !inlineOverride.fontWeight.value().empty()) fontWeight = inlineOverride.fontWeight.value();
                if (inlineOverride.fontStyle.has_value() && !inlineOverride.fontStyle.value().empty()) fontStyle = inlineOverride.fontStyle.value();
                if (inlineOverride.letterSpacing.has_value()) letterSpacing = inlineOverride.letterSpacing.value();
                if (inlineOverride.textTransform.has_value()) textTransform = inlineOverride.textTransform.value();
                if (inlineOverride.textDecorationColor.has_value()) textDecColor = inlineOverride.textDecorationColor.value();
                if (inlineOverride.textDecorationStyle.has_value()) textDecStyle = inlineOverride.textDecorationStyle.value();
                if (inlineOverride.opacity.has_value()) opacity = inlineOverride.opacity.value();
                if (inlineOverride.fontFeatureSettings.has_value() && !inlineOverride.fontFeatureSettings.value().empty()) fontFeatureSettings = inlineOverride.fontFeatureSettings.value();
                if (inlineOverride.textDecorationLine.has_value()) {
                    std::string line = inlineOverride.textDecorationLine.value();
                    if (line.find("underline") != std::string::npos) isUnderline = true;
                    if (line.find("line-through") != std::string::npos) isStrikethrough = true;
                    if (line == "none") { isUnderline = false; isStrikethrough = false; }
                }
            }
        }

        auto inlineNode = std::make_shared<HybridInlineNode>(type, "", url);
        inlineNode->fontSize_ = fontSize;
        inlineNode->color_ = color;
        inlineNode->backgroundColor_ = backgroundColor;
        inlineNode->fontFamily_ = fontFamily;
        inlineNode->fontWeight_ = fontWeight;
        inlineNode->fontStyle_ = fontStyle;
        inlineNode->letterSpacing_ = letterSpacing;
        inlineNode->textTransform_ = textTransform;
        inlineNode->textDecorationColor_ = textDecColor;
        inlineNode->textDecorationStyle_ = textDecStyle;
        inlineNode->opacity_ = opacity;
        inlineNode->fontFeatureSettings_ = fontFeatureSettings;
        inlineNode->isUnderline_ = isUnderline;
        inlineNode->isStrikethrough_ = isStrikethrough;
        inlineNode->isLink_ = isLink;
        inlineNode->baselineShift_ = baselineShift;

        StyleContext childCtx;
        childCtx.fontSize = fontSize;
        childCtx.color = color;
        childCtx.backgroundColor = backgroundColor;
        childCtx.fontFamily = fontFamily;
        childCtx.fontWeight = fontWeight;
        childCtx.fontStyle = fontStyle;
        childCtx.letterSpacing = letterSpacing;
        childCtx.textTransform = textTransform;
        childCtx.opacity = opacity;
        childCtx.fontFeatureSettings = fontFeatureSettings;

        lxb_dom_node_t* child = node->first_child;
        while (child) {
            auto childInline = parseInlineNode(child, childCtx, tagsStyles);
            if (childInline) {
                inlineNode->children_.push_back(childInline);
            }
            child = child->next;
        }
        return inlineNode;
    }

    return nullptr;
}

static void collectInlineChildren(
    lxb_dom_node_t* parent,
    std::vector<std::shared_ptr<HybridInlineNode>>& inlines,
    const StyleContext& ctx,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    if (!parent) return;
    lxb_dom_node_t* child = parent->first_child;
    while (child) {
        auto in = parseInlineNode(child, ctx, tagsStyles);
        if (in) {
            inlines.push_back(in);
        }
        child = child->next;
    }
}

static void walkDomNode(
    lxb_dom_node_t* node,
    std::vector<std::shared_ptr<HybridContentBlock>>& blocks,
    const StyleContext& baseCtx,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
);

static void walkDomChildren(
    lxb_dom_node_t* parent,
    std::vector<std::shared_ptr<HybridContentBlock>>& blocks,
    const StyleContext& baseCtx,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    if (!parent) return;
    lxb_dom_node_t* child = parent->first_child;
    while (child) {
        walkDomNode(child, blocks, baseCtx, tagsStyles);
        child = child->next;
    }
}

static void walkDomNode(
    lxb_dom_node_t* node,
    std::vector<std::shared_ptr<HybridContentBlock>>& blocks,
    const StyleContext& baseCtx,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    if (!node) return;

    if (node->type == LXB_DOM_NODE_TYPE_TEXT) {
        std::string str = getNodeText(node);
        size_t first = str.find_first_not_of(" \t\n\r");
        if (first != std::string::npos) {
            auto p = std::make_shared<HybridContentBlock>("Paragraph");
            p->html_ = "<p>" + str + "</p>";
            p->fontSize_ = baseCtx.fontSize;
            p->color_ = baseCtx.color;
            p->fontFamily_ = baseCtx.fontFamily;
            p->fontWeight_ = baseCtx.fontWeight;
            p->fontStyle_ = baseCtx.fontStyle;
            p->marginBottom_ = 12.0;

            auto in = std::make_shared<HybridInlineNode>("Text", str, "");
            in->fontSize_ = baseCtx.fontSize;
            in->color_ = baseCtx.color;
            in->fontFamily_ = baseCtx.fontFamily;
            in->fontWeight_ = baseCtx.fontWeight;
            in->fontStyle_ = baseCtx.fontStyle;
            p->children_.push_back(in);
            blocks.push_back(p);
        }
        return;
    }

    if (node->type != LXB_DOM_NODE_TYPE_ELEMENT) {
        return;
    }

    lxb_tag_id_t tagId = lxb_dom_node_tag_id(node);
    lxb_dom_element_t* elem = lxb_dom_interface_element(node);
    std::string tagName = getNodeTagName(node);

    // Skip script, style, head, meta, link, template
    if (tagId == LXB_TAG_SCRIPT || tagId == LXB_TAG_STYLE || tagId == LXB_TAG_HEAD ||
        tagId == LXB_TAG_TITLE || tagId == LXB_TAG_META || tagId == LXB_TAG_LINK ||
        tagId == LXB_TAG_TEMPLATE) {
        return;
    }

    // Headings: <h1> to <h6>
    if (tagId >= LXB_TAG_H1 && tagId <= LXB_TAG_H6) {
        auto block = std::make_shared<HybridContentBlock>("Heading");
        block->html_ = serializeNodeHtml(node);
        block->level_ = static_cast<double>(tagId - LXB_TAG_H1 + 1);
        block->fontWeight_ = "bold";
        block->color_ = baseCtx.color;
        block->fontFamily_ = baseCtx.fontFamily;

        if (block->level_ == 1) {
            block->fontSize_ = baseCtx.fontSize * 2.0; block->marginTop_ = 16.0; block->marginBottom_ = 12.0;
        } else if (block->level_ == 2) {
            block->fontSize_ = baseCtx.fontSize * 1.5; block->marginTop_ = 14.0; block->marginBottom_ = 10.0;
        } else if (block->level_ == 3) {
            block->fontSize_ = baseCtx.fontSize * 1.25; block->marginTop_ = 12.0; block->marginBottom_ = 8.0;
        } else if (block->level_ == 4) {
            block->fontSize_ = baseCtx.fontSize * 1.125; block->marginTop_ = 10.0; block->marginBottom_ = 6.0;
        } else if (block->level_ == 5) {
            block->fontSize_ = baseCtx.fontSize * 1.0; block->marginTop_ = 8.0; block->marginBottom_ = 4.0;
        } else {
            block->fontSize_ = baseCtx.fontSize * 0.875; block->marginTop_ = 8.0; block->marginBottom_ = 4.0;
        }

        StyleContext hCtx = baseCtx;
        hCtx.fontSize = block->fontSize_;
        hCtx.fontWeight = block->fontWeight_;
        hCtx.color = block->color_;
        applyNodeStyling(block.get(), elem, tagName, tagsStyles, hCtx);

        collectInlineChildren(node, block->children_, hCtx, tagsStyles);
        blocks.push_back(block);
        return;
    }

    // Paragraph: <p>
    if (tagId == LXB_TAG_P) {
        auto block = std::make_shared<HybridContentBlock>("Paragraph");
        block->html_ = serializeNodeHtml(node);
        block->fontSize_ = baseCtx.fontSize;
        block->color_ = baseCtx.color;
        block->backgroundColor_ = baseCtx.backgroundColor;
        block->fontFamily_ = baseCtx.fontFamily;
        block->fontWeight_ = baseCtx.fontWeight;
        block->fontStyle_ = baseCtx.fontStyle;
        block->lineHeight_ = baseCtx.lineHeight;
        block->marginBottom_ = 12.0;

        StyleContext pCtx = baseCtx;
        applyNodeStyling(block.get(), elem, "p", tagsStyles, pCtx);

        collectInlineChildren(node, block->children_, pCtx, tagsStyles);
        blocks.push_back(block);
        return;
    }

    // Blockquote: <blockquote>
    if (tagId == LXB_TAG_BLOCKQUOTE || tagId == LXB_TAG_Q) {
        auto block = std::make_shared<HybridContentBlock>("Quote");
        block->html_ = serializeNodeHtml(node);
        block->fontSize_ = baseCtx.fontSize;
        block->fontStyle_ = "italic";
        block->color_ = "#334155";
        block->backgroundColor_ = "#FAF5FF";
        block->fontFamily_ = baseCtx.fontFamily;
        block->marginLeft_ = 20.0;
        block->marginRight_ = 20.0;
        block->paddingLeft_ = 16.0;
        block->marginBottom_ = 12.0;
        block->borderLeftWidth_ = 4.0;
        block->borderLeftColor_ = "#94A3B8";

        StyleContext qCtx = baseCtx;
        applyNodeStyling(block.get(), elem, tagName, tagsStyles, qCtx);

        bool hasBlockChildren = false;
        lxb_dom_node_t* child = node->first_child;
        while (child) {
            if (child->type == LXB_DOM_NODE_TYPE_ELEMENT) {
                lxb_tag_id_t tid = lxb_dom_node_tag_id(child);
                if (tid == LXB_TAG_P || (tid >= LXB_TAG_H1 && tid <= LXB_TAG_H6) ||
                    tid == LXB_TAG_UL || tid == LXB_TAG_OL || tid == LXB_TAG_BLOCKQUOTE ||
                    tid == LXB_TAG_PRE || tid == LXB_TAG_TABLE) {
                    hasBlockChildren = true;
                    break;
                }
            }
            child = child->next;
        }

        if (hasBlockChildren) {
            walkDomChildren(node, block->quoteChildren_, qCtx, tagsStyles);
            for (size_t qi = 0; qi < block->quoteChildren_.size(); ++qi) {
                const auto& qChild = block->quoteChildren_[qi];
                if (!qChild) continue;
                for (const auto& inNode : qChild->children_) {
                    block->children_.push_back(inNode);
                }
                if (qi < block->quoteChildren_.size() - 1) {
                    block->children_.push_back(std::make_shared<HybridInlineNode>("Break", "", ""));
                }
            }
        } else {
            auto p = std::make_shared<HybridContentBlock>("Paragraph");
            p->html_ = serializeNodeHtml(node);
            p->fontSize_ = block->fontSize_;
            p->color_ = block->color_;
            p->fontStyle_ = block->fontStyle_;
            p->fontFamily_ = block->fontFamily_;
            collectInlineChildren(node, p->children_, qCtx, tagsStyles);
            block->quoteChildren_.push_back(p);
            for (const auto& inNode : p->children_) {
                block->children_.push_back(inNode);
            }
        }
        blocks.push_back(block);
        return;
    }

    // Pre / CodeBlock: <pre>
    if (tagId == LXB_TAG_PRE) {
        auto block = std::make_shared<HybridContentBlock>("CodeBlock");
        block->fontFamily_ = "monospace";
        block->fontSize_ = baseCtx.fontSize * 0.9;
        block->color_ = "#0F172A";
        block->backgroundColor_ = "#F8FAFC";
        block->paddingLeft_ = 12.0;
        block->marginBottom_ = 12.0;

        StyleContext preCtx = baseCtx;
        preCtx.fontFamily = "monospace";
        preCtx.fontSize = block->fontSize_;
        preCtx.color = block->color_;
        preCtx.backgroundColor = block->backgroundColor_;
        applyNodeStyling(block.get(), elem, "pre", tagsStyles, preCtx);

        lxb_dom_node_t* codeNode = nullptr;
        lxb_dom_node_t* c = node->first_child;
        while (c) {
            if (c->type == LXB_DOM_NODE_TYPE_ELEMENT && lxb_dom_node_tag_id(c) == LXB_TAG_CODE) {
                codeNode = c;
                break;
            }
            c = c->next;
        }
        if (codeNode) {
            lxb_dom_element_t* codeElem = lxb_dom_interface_element(codeNode);
            std::string cls = getAttribute(codeElem, "class");
            if (cls.rfind("language-", 0) == 0) {
                block->language_ = cls.substr(9);
            } else if (!cls.empty()) {
                block->language_ = cls;
            }
            block->code_ = getNodeText(codeNode);
        } else {
            block->code_ = getNodeText(node);
        }
        block->html_ = serializeNodeHtml(node);
        blocks.push_back(block);
        return;
    }

    // Lists: <ul>, <ol>
    if (tagId == LXB_TAG_UL || tagId == LXB_TAG_OL) {
        auto block = std::make_shared<HybridContentBlock>("List");
        block->ordered_ = (tagId == LXB_TAG_OL);
        block->fontSize_ = baseCtx.fontSize;
        block->color_ = baseCtx.color;
        block->fontFamily_ = baseCtx.fontFamily;
        block->paddingLeft_ = 20.0;
        block->marginBottom_ = 12.0;
        block->html_ = serializeNodeHtml(node);

        StyleContext listCtx = baseCtx;
        applyNodeStyling(block.get(), elem, tagName, tagsStyles, listCtx);

        lxb_dom_node_t* li = node->first_child;
        while (li) {
            if (li->type == LXB_DOM_NODE_TYPE_ELEMENT && lxb_dom_node_tag_id(li) == LXB_TAG_LI) {
                auto item = std::make_shared<HybridListItem>();
                StyleContext liCtx = listCtx;
                lxb_dom_element_t* liElem = lxb_dom_interface_element(li);
                applyNodeStyling(nullptr, liElem, "li", tagsStyles, liCtx);

                lxb_dom_node_t* liChild = li->first_child;
                while (liChild) {
                    if (liChild->type == LXB_DOM_NODE_TYPE_ELEMENT) {
                        lxb_tag_id_t liChildTag = lxb_dom_node_tag_id(liChild);
                        if (liChildTag == LXB_TAG_UL || liChildTag == LXB_TAG_OL) {
                            std::vector<std::shared_ptr<HybridContentBlock>> nestedBlocks;
                            walkDomNode(liChild, nestedBlocks, liCtx, tagsStyles);
                            for (auto& nb : nestedBlocks) {
                                item->nested_.push_back(nb);
                            }
                            liChild = liChild->next;
                            continue;
                        }
                    }
                    auto inlineChild = parseInlineNode(liChild, liCtx, tagsStyles);
                    if (inlineChild) {
                        item->children_.push_back(inlineChild);
                    }
                    liChild = liChild->next;
                }
                block->items_.push_back(item);
            }
            li = li->next;
        }
        blocks.push_back(block);
        return;
    }

    // Table: <table>
    if (tagId == LXB_TAG_TABLE) {
        auto block = std::make_shared<HybridContentBlock>("Table");
        block->html_ = serializeNodeHtml(node);
        block->fontSize_ = baseCtx.fontSize * 0.9375;
        block->color_ = baseCtx.color;
        block->fontFamily_ = baseCtx.fontFamily;
        block->borderLeftColor_ = "#1E3A8A";
        block->borderLeftWidth_ = 1.5;
        block->marginTop_ = 6.0;
        block->marginBottom_ = 14.0;
        block->paddingLeft_ = 12.0;
        block->paddingTop_ = 8.0;

        StyleContext tableCtx = baseCtx;
        tableCtx.fontSize = block->fontSize_;
        tableCtx.color = block->color_;
        tableCtx.fontFamily = block->fontFamily_;
        applyNodeStyling(block.get(), elem, "table", tagsStyles, tableCtx);

        auto processRow = [&](lxb_dom_node_t* tr) {
            auto row = std::make_shared<HybridTableRow>();
            lxb_dom_node_t* cell = tr->first_child;
            while (cell) {
                if (cell->type == LXB_DOM_NODE_TYPE_ELEMENT) {
                    lxb_tag_id_t cellTag = lxb_dom_node_tag_id(cell);
                    if (cellTag == LXB_TAG_TH || cellTag == LXB_TAG_TD) {
                        auto tableCell = std::make_shared<HybridTableCell>();
                        StyleContext cellCtx = tableCtx;
                        if (cellTag == LXB_TAG_TH) cellCtx.fontWeight = "bold";
                        lxb_dom_element_t* cellElem = lxb_dom_interface_element(cell);
                        applyNodeStyling(nullptr, cellElem, cellTag == LXB_TAG_TH ? "th" : "td", tagsStyles, cellCtx);
                        collectInlineChildren(cell, tableCell->children_, cellCtx, tagsStyles);
                        row->cells_.push_back(tableCell);
                    }
                }
                cell = cell->next;
            }
            if (!row->cells_.empty()) {
                block->rows_.push_back(row);
            }
        };

        std::function<void(lxb_dom_node_t*)> walkTable = [&](lxb_dom_node_t* tNode) {
            lxb_dom_node_t* child = tNode->first_child;
            while (child) {
                if (child->type == LXB_DOM_NODE_TYPE_ELEMENT) {
                    lxb_tag_id_t tid = lxb_dom_node_tag_id(child);
                    if (tid == LXB_TAG_TR) {
                        processRow(child);
                    } else if (tid == LXB_TAG_THEAD || tid == LXB_TAG_TBODY || tid == LXB_TAG_TFOOT) {
                        walkTable(child);
                    }
                }
                child = child->next;
            }
        };
        walkTable(node);

        // Flatten table rows into block->children_ for flat native text rendering
        for (size_t ri = 0; ri < block->rows_.size(); ++ri) {
            const auto& row = block->rows_[ri];
            if (!row) continue;
            for (size_t ci = 0; ci < row->cells_.size(); ++ci) {
                const auto& cell = row->cells_[ci];
                if (!cell) continue;
                for (const auto& inNode : cell->children_) {
                    block->children_.push_back(inNode);
                }
                if (ci < row->cells_.size() - 1) {
                    auto sep = std::make_shared<HybridInlineNode>("Text", "   |   ", "");
                    sep->color_ = "#94A3B8";
                    block->children_.push_back(sep);
                }
            }
            if (ri < block->rows_.size() - 1) {
                block->children_.push_back(std::make_shared<HybridInlineNode>("Break", "", ""));
            }
        }

        blocks.push_back(block);
        return;
    }

    // Definition list: <dl>
    if (tagId == LXB_TAG_DL) {
        auto block = std::make_shared<HybridContentBlock>("DefinitionList");
        block->html_ = serializeNodeHtml(node);
        block->fontSize_ = baseCtx.fontSize;
        block->color_ = baseCtx.color;
        block->fontFamily_ = baseCtx.fontFamily;
        block->marginBottom_ = 12.0;

        StyleContext dlCtx = baseCtx;
        applyNodeStyling(block.get(), elem, "dl", tagsStyles, dlCtx);

        lxb_dom_node_t* dlChild = node->first_child;
        std::shared_ptr<HybridDefinitionItem> currentItem = nullptr;
        while (dlChild) {
            if (dlChild->type == LXB_DOM_NODE_TYPE_ELEMENT) {
                lxb_tag_id_t tid = lxb_dom_node_tag_id(dlChild);
                lxb_dom_element_t* dlChildElem = lxb_dom_interface_element(dlChild);
                if (tid == LXB_TAG_DT) {
                    currentItem = std::make_shared<HybridDefinitionItem>();
                    StyleContext dtCtx = dlCtx;
                    dtCtx.fontWeight = "bold";
                    applyNodeStyling(nullptr, dlChildElem, "dt", tagsStyles, dtCtx);
                    collectInlineChildren(dlChild, currentItem->terms_, dtCtx, tagsStyles);
                    block->defItems_.push_back(currentItem);
                } else if (tid == LXB_TAG_DD) {
                    if (!currentItem) {
                        currentItem = std::make_shared<HybridDefinitionItem>();
                        block->defItems_.push_back(currentItem);
                    }
                    StyleContext ddCtx = dlCtx;
                    applyNodeStyling(nullptr, dlChildElem, "dd", tagsStyles, ddCtx);
                    collectInlineChildren(dlChild, currentItem->defs_, ddCtx, tagsStyles);
                }
            }
            dlChild = dlChild->next;
        }

        // Flatten definition items into block->children_ for flat native text rendering
        for (size_t di = 0; di < block->defItems_.size(); ++di) {
            const auto& item = block->defItems_[di];
            if (!item) continue;
            for (const auto& termNode : item->terms_) {
                block->children_.push_back(termNode);
            }
            if (!item->terms_.empty() && !item->defs_.empty()) {
                auto colon = std::make_shared<HybridInlineNode>("Text", ": ", "");
                colon->fontWeight_ = "bold";
                colon->color_ = block->color_;
                block->children_.push_back(colon);
            }
            for (const auto& defNode : item->defs_) {
                block->children_.push_back(defNode);
            }
            if (di < block->defItems_.size() - 1) {
                block->children_.push_back(std::make_shared<HybridInlineNode>("Break", "", ""));
            }
        }

        blocks.push_back(block);
        return;
    }

    // Image: <img>
    if (tagId == LXB_TAG_IMG) {
        auto block = std::make_shared<HybridContentBlock>("Image");
        block->html_ = serializeNodeHtml(node);
        block->url_ = getAttribute(elem, "src");
        block->alt_ = getAttribute(elem, "alt");
        block->title_ = getAttribute(elem, "title");
        block->fontSize_ = baseCtx.fontSize;
        block->marginTop_ = 6.0;
        block->marginBottom_ = 14.0;
        block->backgroundColor_ = "#F1F5F9";

        StyleContext imgCtx = baseCtx;
        applyNodeStyling(block.get(), elem, "img", tagsStyles, imgCtx);

        std::string label = "🖼️ " + (!block->alt_.empty() ? "[" + block->alt_ + "]" : "[Image]");
        auto imgNode = std::make_shared<HybridInlineNode>("Text", label, "");
        imgNode->fontStyle_ = "italic";
        imgNode->color_ = "#64748B";
        imgNode->fontSize_ = baseCtx.fontSize;
        block->children_.push_back(imgNode);

        blocks.push_back(block);
        return;
    }

    // Figure: <figure>
    if (tagId == LXB_TAG_FIGURE) {
        auto block = std::make_shared<HybridContentBlock>("Figure");
        block->html_ = serializeNodeHtml(node);
        block->fontSize_ = baseCtx.fontSize * 0.8125;
        block->color_ = "#475569";
        block->marginTop_ = 6.0;
        block->marginBottom_ = 14.0;
        block->backgroundColor_ = "#F1F5F9";
        block->paddingTop_ = 4.0;

        StyleContext figCtx = baseCtx;
        applyNodeStyling(block.get(), elem, "figure", tagsStyles, figCtx);

        std::function<void(lxb_dom_node_t*)> scanFigure = [&](lxb_dom_node_t* fNode) {
            lxb_dom_node_t* c = fNode->first_child;
            while (c) {
                if (c->type == LXB_DOM_NODE_TYPE_ELEMENT) {
                    lxb_tag_id_t tid = lxb_dom_node_tag_id(c);
                    if (tid == LXB_TAG_IMG) {
                        lxb_dom_element_t* imgElem = lxb_dom_interface_element(c);
                        block->url_ = getAttribute(imgElem, "src");
                        block->alt_ = getAttribute(imgElem, "alt");
                    } else if (tid == LXB_TAG_FIGCAPTION) {
                        block->caption_ = getNodeText(c);
                    } else {
                        scanFigure(c);
                    }
                }
                c = c->next;
            }
        };
        scanFigure(node);

        std::string imgLabel = "🖼️ " + (!block->alt_.empty() ? "[" + block->alt_ + "]" : "[Figure Image]");
        auto imgNode = std::make_shared<HybridInlineNode>("Text", imgLabel, "");
        imgNode->fontStyle_ = "italic";
        imgNode->color_ = "#64748B";
        imgNode->fontSize_ = baseCtx.fontSize;
        block->children_.push_back(imgNode);

        if (!block->caption_.empty()) {
            block->children_.push_back(std::make_shared<HybridInlineNode>("Break", "", ""));
            auto capNode = std::make_shared<HybridInlineNode>("Text", block->caption_, "");
            capNode->fontStyle_ = "italic";
            capNode->color_ = block->color_;
            capNode->fontSize_ = block->fontSize_;
            block->children_.push_back(capNode);
        }

        blocks.push_back(block);
        return;
    }

    // Video: <video>
    if (tagId == LXB_TAG_VIDEO) {
        auto block = std::make_shared<HybridContentBlock>("Video");
        block->html_ = serializeNodeHtml(node);
        block->src_ = getAttribute(elem, "src");
        block->poster_ = getAttribute(elem, "poster");
        if (block->src_.empty()) {
            lxb_dom_node_t* c = node->first_child;
            while (c) {
                if (c->type == LXB_DOM_NODE_TYPE_ELEMENT && lxb_dom_node_tag_id(c) == LXB_TAG_SOURCE) {
                    block->src_ = getAttribute(lxb_dom_interface_element(c), "src");
                    if (!block->src_.empty()) break;
                }
                c = c->next;
            }
        }
        blocks.push_back(block);
        return;
    }

    // Audio: <audio>
    if (tagId == LXB_TAG_AUDIO) {
        auto block = std::make_shared<HybridContentBlock>("Audio");
        block->html_ = serializeNodeHtml(node);
        block->src_ = getAttribute(elem, "src");
        if (block->src_.empty()) {
            lxb_dom_node_t* c = node->first_child;
            while (c) {
                if (c->type == LXB_DOM_NODE_TYPE_ELEMENT && lxb_dom_node_tag_id(c) == LXB_TAG_SOURCE) {
                    block->src_ = getAttribute(lxb_dom_interface_element(c), "src");
                    if (!block->src_.empty()) break;
                }
                c = c->next;
            }
        }
        blocks.push_back(block);
        return;
    }

    // Separator: <hr>
    if (tagId == LXB_TAG_HR) {
        auto block = std::make_shared<HybridContentBlock>("Separator");
        block->html_ = serializeNodeHtml(node);
        block->color_ = "#E2E8F0";
        block->backgroundColor_ = "#E2E8F0";
        block->marginTop_ = 16.0;
        block->marginBottom_ = 16.0;
        block->lineHeight_ = 1.0;

        StyleContext hrCtx = baseCtx;
        applyNodeStyling(block.get(), elem, "hr", tagsStyles, hrCtx);

        blocks.push_back(block);
        return;
    }

    // Standard structural containers -> recurse into children
    if (tagId == LXB_TAG_DIV || tagId == LXB_TAG_SECTION || tagId == LXB_TAG_ARTICLE ||
        tagId == LXB_TAG_MAIN || tagId == LXB_TAG_HEADER || tagId == LXB_TAG_FOOTER ||
        tagId == LXB_TAG_ASIDE || tagId == LXB_TAG_NAV || tagId == LXB_TAG_BODY ||
        tagId == LXB_TAG_HTML || tagId == LXB_TAG_CENTER || tagId == LXB_TAG_FORM ||
        tagId == LXB_TAG_FIELDSET) {
        StyleContext divCtx = baseCtx;
        applyNodeStyling(nullptr, elem, tagName, tagsStyles, divCtx);
        walkDomChildren(node, blocks, divCtx, tagsStyles);
        return;
    }

    // Custom or unrecognized tags
    if (!tagName.empty() && tagName.find('-') != std::string::npos) {
        auto block = std::make_shared<HybridContentBlock>(tagName);
        block->html_ = serializeNodeHtml(node);
        block->fontSize_ = baseCtx.fontSize;
        block->color_ = baseCtx.color;
        block->fontFamily_ = baseCtx.fontFamily;
        block->marginBottom_ = 12.0;
        block->src_ = getAttribute(elem, "src");
        block->title_ = getAttribute(elem, "title");
        block->alt_ = getAttribute(elem, "id");
        StyleContext customCtx = baseCtx;
        applyNodeStyling(block.get(), elem, tagName, tagsStyles, customCtx);
        collectInlineChildren(node, block->children_, customCtx, tagsStyles);
        blocks.push_back(block);
        return;
    }

    // Fallback: Inline phrasing element (e.g. <cite>, <span>, <em>, <strong>, <a>, <q>) or generic element at root
    auto in = parseInlineNode(node, baseCtx, tagsStyles);
    if (in) {
        auto p = std::make_shared<HybridContentBlock>("Paragraph");
        p->html_ = serializeNodeHtml(node);
        p->fontSize_ = in->fontSize_;
        p->color_ = in->color_;
        p->fontFamily_ = in->fontFamily_;
        p->fontWeight_ = in->fontWeight_;
        p->fontStyle_ = in->fontStyle_;
        p->marginBottom_ = 12.0;
        p->children_.push_back(in);
        blocks.push_back(p);
    }
}

// ── Thread-Safe In-Memory LRU AST Cache (Eliminates Duplicate HTML Parsing) ──
struct AstCacheKey {
    std::string html;
    std::string styleSignature;

    bool operator==(const AstCacheKey& other) const {
        return html == other.html && styleSignature == other.styleSignature;
    }
};

struct AstCacheKeyHash {
    std::size_t operator()(const AstCacheKey& k) const {
        std::size_t h1 = std::hash<std::string>{}(k.html);
        std::size_t h2 = std::hash<std::string>{}(k.styleSignature);
        return h1 ^ (h2 << 1);
    }
};

static std::string computeStyleSignature(
    const std::optional<NativeTextStyle>& baseStyle,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    std::string sig;
    if (baseStyle.has_value()) {
        const auto& b = baseStyle.value();
        if (b.fontSize.has_value()) sig += "fs:" + std::to_string(b.fontSize.value()) + ";";
        if (b.color.has_value()) sig += "c:" + b.color.value() + ";";
        if (b.backgroundColor.has_value()) sig += "bg:" + b.backgroundColor.value() + ";";
        if (b.fontFamily.has_value()) sig += "ff:" + b.fontFamily.value() + ";";
        if (b.fontWeight.has_value()) sig += "fw:" + b.fontWeight.value() + ";";
        if (b.fontStyle.has_value()) sig += "fst:" + b.fontStyle.value() + ";";
        if (b.lineHeight.has_value()) sig += "lh:" + std::to_string(b.lineHeight.value()) + ";";
        if (b.fontFeatureSettings.has_value()) sig += "ffs:" + b.fontFeatureSettings.value() + ";";
    }
    if (tagsStyles.has_value()) {
        sig += "ts:" + std::to_string(tagsStyles.value().size()) + ";";
        for (const auto& pair : tagsStyles.value()) {
            sig += pair.first + ":";
            if (pair.second.fontSize.has_value()) sig += std::to_string(pair.second.fontSize.value());
            if (pair.second.color.has_value()) sig += pair.second.color.value();
            if (pair.second.fontFamily.has_value()) sig += pair.second.fontFamily.value();
            if (pair.second.fontWeight.has_value()) sig += pair.second.fontWeight.value();
            if (pair.second.fontStyle.has_value()) sig += pair.second.fontStyle.value();
            if (pair.second.fontFeatureSettings.has_value()) sig += pair.second.fontFeatureSettings.value();
            sig += "|";
        }
    }
    return sig;
}

static std::mutex sAstCacheMutex;
static std::list<std::pair<AstCacheKey, std::shared_ptr<HybridParsedArticle>>> sAstLruList;
static std::unordered_map<AstCacheKey, decltype(sAstLruList)::iterator, AstCacheKeyHash> sAstLruMap;
constexpr size_t MAX_AST_CACHE_SIZE = 16;

// ── parseInternal ─────────────────────────────────────────────────────────────
std::shared_ptr<HybridParsedArticle> HybridFastHtmlParser::parseInternal(
    const std::string& html,
    const std::optional<NativeTextStyle>& baseStyle,
    const std::optional<std::unordered_map<std::string, NativeTextStyle>>& tagsStyles
) {
    if (html.empty()) {
        return std::make_shared<HybridParsedArticle>();
    }

    AstCacheKey cacheKey { html, computeStyleSignature(baseStyle, tagsStyles) };

    {
        std::lock_guard<std::mutex> lock(sAstCacheMutex);
        auto it = sAstLruMap.find(cacheKey);
        if (it != sAstLruMap.end()) {
            // Move accessed item to the front of LRU list (0ms cache hit)
            sAstLruList.splice(sAstLruList.begin(), sAstLruList, it->second);
            return it->second->second;
        }
    }

    lxb_html_parser_t* parser = lxb_html_parser_create();
    if (!parser) {
        return std::make_shared<HybridParsedArticle>();
    }

    lxb_status_t status = lxb_html_parser_init(parser);
    if (status != LXB_STATUS_OK) {
        lxb_html_parser_destroy(parser);
        return std::make_shared<HybridParsedArticle>();
    }

    lxb_html_document_t* document = lxb_html_parse(
        parser,
        reinterpret_cast<const lxb_char_t*>(html.c_str()),
        html.length()
    );

    std::vector<std::shared_ptr<HybridContentBlock>> blocks;

    if (document) {
        lxb_dom_node_t* rootNode = nullptr;
        if (document->body) {
            rootNode = lxb_dom_interface_node(document->body);
        } else if (document->dom_document.element) {
            rootNode = lxb_dom_interface_node(document->dom_document.element);
        }

        if (rootNode) {
            StyleContext baseCtx;
            if (baseStyle.has_value()) {
                const auto& b = baseStyle.value();
                if (b.fontSize.has_value() && b.fontSize.value() > 0) baseCtx.fontSize = b.fontSize.value();
                if (b.color.has_value() && !b.color.value().empty()) baseCtx.color = b.color.value();
                if (b.backgroundColor.has_value() && !b.backgroundColor.value().empty()) baseCtx.backgroundColor = b.backgroundColor.value();
                if (b.fontFamily.has_value() && !b.fontFamily.value().empty()) baseCtx.fontFamily = b.fontFamily.value();
                if (b.fontWeight.has_value() && !b.fontWeight.value().empty()) baseCtx.fontWeight = b.fontWeight.value();
                if (b.fontStyle.has_value() && !b.fontStyle.value().empty()) baseCtx.fontStyle = b.fontStyle.value();
                if (b.lineHeight.has_value() && b.lineHeight.value() > 0) baseCtx.lineHeight = b.lineHeight.value();
                if (b.fontFeatureSettings.has_value() && !b.fontFeatureSettings.value().empty()) baseCtx.fontFeatureSettings = b.fontFeatureSettings.value();
            }
            walkDomChildren(rootNode, blocks, baseCtx, tagsStyles);
        }

        lxb_html_document_destroy(document);
    }

    lxb_html_parser_destroy(parser);

    auto article = std::make_shared<HybridParsedArticle>(std::move(blocks));

    {
        std::lock_guard<std::mutex> lock(sAstCacheMutex);
        auto it = sAstLruMap.find(cacheKey);
        if (it != sAstLruMap.end()) {
            sAstLruList.splice(sAstLruList.begin(), sAstLruList, it->second);
            return it->second->second;
        }

        sAstLruList.emplace_front(cacheKey, article);
        sAstLruMap[cacheKey] = sAstLruList.begin();

        if (sAstLruList.size() > MAX_AST_CACHE_SIZE) {
            sAstLruMap.erase(sAstLruList.back().first);
            sAstLruList.pop_back();
        }
    }

    return article;
}

// ── JSON Serialization for AST ───────────────────────────────────────────────
static std::string escapeJson(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += c;
                }
                break;
        }
    }
    return out;
}

static void inlineNodeToJson(const std::shared_ptr<HybridInlineNode>& node, std::string& out) {
    if (!node) { out += "null"; return; }
    out += "{";
    out += "\"type\":\"" + escapeJson(node->type_) + "\",";
    out += "\"text\":\"" + escapeJson(node->text_) + "\",";
    out += "\"url\":\"" + escapeJson(node->url_) + "\",";
    out += "\"fontSize\":" + std::to_string(node->fontSize_) + ",";
    out += "\"color\":\"" + escapeJson(node->color_) + "\",";
    out += "\"backgroundColor\":\"" + escapeJson(node->backgroundColor_) + "\",";
    out += "\"fontFamily\":\"" + escapeJson(node->fontFamily_) + "\",";
    out += "\"fontWeight\":\"" + escapeJson(node->fontWeight_) + "\",";
    out += "\"fontStyle\":\"" + escapeJson(node->fontStyle_) + "\",";
    out += "\"letterSpacing\":" + std::to_string(node->letterSpacing_) + ",";
    out += "\"textTransform\":\"" + escapeJson(node->textTransform_) + "\",";
    out += "\"textDecorationColor\":\"" + escapeJson(node->textDecorationColor_) + "\",";
    out += "\"textDecorationStyle\":\"" + escapeJson(node->textDecorationStyle_) + "\",";
    out += "\"opacity\":" + std::to_string(node->opacity_) + ",";
    out += "\"isUnderline\":" + std::string(node->isUnderline_ ? "true" : "false") + ",";
    out += "\"isStrikethrough\":" + std::string(node->isStrikethrough_ ? "true" : "false") + ",";
    out += "\"isLink\":" + std::string(node->isLink_ ? "true" : "false") + ",";
    out += "\"baselineShift\":" + std::to_string(node->baselineShift_) + ",";
    out += "\"fontFeatureSettings\":\"" + escapeJson(node->fontFeatureSettings_) + "\",";
    out += "\"children\":[";
    for (size_t i = 0; i < node->children_.size(); ++i) {
        if (i > 0) out += ",";
        inlineNodeToJson(node->children_[i], out);
    }
    out += "]}";
}

static void contentBlockToJson(const std::shared_ptr<HybridContentBlock>& block, std::string& out) {
    if (!block) { out += "null"; return; }
    out += "{";
    out += "\"type\":\"" + escapeJson(block->type_) + "\",";
    out += "\"level\":" + std::to_string(block->level_) + ",";
    out += "\"fontSize\":" + std::to_string(block->fontSize_) + ",";
    out += "\"color\":\"" + escapeJson(block->color_) + "\",";
    out += "\"backgroundColor\":\"" + escapeJson(block->backgroundColor_) + "\",";
    out += "\"fontFamily\":\"" + escapeJson(block->fontFamily_) + "\",";
    out += "\"fontWeight\":\"" + escapeJson(block->fontWeight_) + "\",";
    out += "\"fontStyle\":\"" + escapeJson(block->fontStyle_) + "\",";
    out += "\"lineHeight\":" + std::to_string(block->lineHeight_) + ",";
    out += "\"letterSpacing\":" + std::to_string(block->letterSpacing_) + ",";
    out += "\"textAlign\":\"" + escapeJson(block->textAlign_) + "\",";
    out += "\"textTransform\":\"" + escapeJson(block->textTransform_) + "\",";
    out += "\"textIndent\":" + std::to_string(block->textIndent_) + ",";
    out += "\"marginTop\":" + std::to_string(block->marginTop_) + ",";
    out += "\"marginBottom\":" + std::to_string(block->marginBottom_) + ",";
    out += "\"marginLeft\":" + std::to_string(block->marginLeft_) + ",";
    out += "\"marginRight\":" + std::to_string(block->marginRight_) + ",";
    out += "\"paddingTop\":" + std::to_string(block->paddingTop_) + ",";
    out += "\"paddingBottom\":" + std::to_string(block->paddingBottom_) + ",";
    out += "\"paddingLeft\":" + std::to_string(block->paddingLeft_) + ",";
    out += "\"paddingRight\":" + std::to_string(block->paddingRight_) + ",";
    out += "\"borderLeftColor\":\"" + escapeJson(block->borderLeftColor_) + "\",";
    out += "\"borderLeftWidth\":" + std::to_string(block->borderLeftWidth_) + ",";
    out += "\"borderRadius\":" + std::to_string(block->borderRadius_) + ",";
    out += "\"fontFeatureSettings\":\"" + escapeJson(block->fontFeatureSettings_) + "\",";
    out += "\"opacity\":" + std::to_string(block->opacity_) + ",";
    out += "\"code\":\"" + escapeJson(block->code_) + "\",";
    out += "\"language\":\"" + escapeJson(block->language_) + "\",";
    out += "\"url\":\"" + escapeJson(block->url_) + "\",";
    out += "\"alt\":\"" + escapeJson(block->alt_) + "\",";
    out += "\"title\":\"" + escapeJson(block->title_) + "\",";
    out += "\"caption\":\"" + escapeJson(block->caption_) + "\",";
    out += "\"src\":\"" + escapeJson(block->src_) + "\",";
    out += "\"poster\":\"" + escapeJson(block->poster_) + "\",";
    out += "\"ordered\":" + std::string(block->ordered_ ? "true" : "false") + ",";
    out += "\"children\":[";
    for (size_t i = 0; i < block->children_.size(); ++i) {
        if (i > 0) out += ",";
        inlineNodeToJson(block->children_[i], out);
    }
    out += "],";
    out += "\"items\":[";
    for (size_t i = 0; i < block->items_.size(); ++i) {
        if (i > 0) out += ",";
        out += "{\"children\":[";
        for (size_t j = 0; j < block->items_[i]->children_.size(); ++j) {
            if (j > 0) out += ",";
            inlineNodeToJson(block->items_[i]->children_[j], out);
        }
        out += "]}";
    }
    out += "],";
    out += "\"rows\":[";
    for (size_t i = 0; i < block->rows_.size(); ++i) {
        if (i > 0) out += ",";
        out += "{\"cells\":[";
        for (size_t j = 0; j < block->rows_[i]->cells_.size(); ++j) {
            if (j > 0) out += ",";
            out += "{\"children\":[";
            for (size_t k = 0; k < block->rows_[i]->cells_[j]->children_.size(); ++k) {
                if (k > 0) out += ",";
                inlineNodeToJson(block->rows_[i]->cells_[j]->children_[k], out);
            }
            out += "]}";
        }
        out += "]}";
    }
    out += "]}";
}

std::string HybridFastHtmlParser::articleToJson(const std::shared_ptr<HybridParsedArticle>& article) {
    if (!article) return "[]";
    std::string out;
    out.reserve(std::max<size_t>(1024, article->blocks_.size() * 512));
    out += "[";
    for (size_t i = 0; i < article->blocks_.size(); ++i) {
        if (i > 0) out += ",";
        contentBlockToJson(article->blocks_[i], out);
    }
    out += "]";
    return out;
}

static std::string extractJsonString(const std::string& json, const std::string& key) {
    std::string needle = "\"" + key + "\":\"";
    size_t pos = json.find(needle);
    if (pos == std::string::npos) {
        needle = "\"" + key + "\": \"";
        pos = json.find(needle);
    }
    if (pos == std::string::npos) return "";
    size_t start = pos + needle.length();
    size_t end = json.find('"', start);
    if (end == std::string::npos) return "";
    return json.substr(start, end - start);
}

static double extractJsonDouble(const std::string& json, const std::string& key, double defaultVal = 0.0) {
    std::string needle = "\"" + key + "\":";
    size_t pos = json.find(needle);
    if (pos == std::string::npos) {
        needle = "\"" + key + "\": ";
        pos = json.find(needle);
    }
    if (pos == std::string::npos) return defaultVal;
    size_t start = pos + needle.length();
    while (start < json.length() && (json[start] == ' ' || json[start] == '\t')) start++;
    try {
        return std::stod(json.substr(start));
    } catch (...) {
        return defaultVal;
    }
}

static NativeTextStyle parseStyleObject(const std::string& json) {
    NativeTextStyle s;
    double fs = extractJsonDouble(json, "fontSize", 0.0);
    if (fs > 0) s.fontSize = fs;
    std::string col = extractJsonString(json, "color");
    if (!col.empty()) s.color = col;
    std::string bg = extractJsonString(json, "backgroundColor");
    if (!bg.empty()) s.backgroundColor = bg;
    std::string ff = extractJsonString(json, "fontFamily");
    if (!ff.empty()) s.fontFamily = ff;
    std::string fw = extractJsonString(json, "fontWeight");
    if (!fw.empty()) s.fontWeight = fw;
    std::string fst = extractJsonString(json, "fontStyle");
    if (!fst.empty()) s.fontStyle = fst;
    double lh = extractJsonDouble(json, "lineHeight", 0.0);
    if (lh > 0) s.lineHeight = lh;
    double ls = extractJsonDouble(json, "letterSpacing", 0.0);
    if (ls != 0.0) s.letterSpacing = ls;
    std::string ta = extractJsonString(json, "textAlign");
    if (!ta.empty()) s.textAlign = ta;
    std::string tt = extractJsonString(json, "textTransform");
    if (!tt.empty()) s.textTransform = tt;
    double ti = extractJsonDouble(json, "textIndent", 0.0);
    if (ti != 0.0) s.textIndent = ti;
    std::string tdl = extractJsonString(json, "textDecorationLine");
    if (!tdl.empty()) s.textDecorationLine = tdl;
    std::string tdc = extractJsonString(json, "textDecorationColor");
    if (!tdc.empty()) s.textDecorationColor = tdc;
    std::string tds = extractJsonString(json, "textDecorationStyle");
    if (!tds.empty()) s.textDecorationStyle = tds;
    double op = extractJsonDouble(json, "opacity", 1.0);
    if (op < 1.0) s.opacity = op;
    double m = extractJsonDouble(json, "margin", 0.0);
    if (m > 0) s.margin = m;
    double mv = extractJsonDouble(json, "marginVertical", 0.0);
    if (mv > 0) s.marginVertical = mv;
    double mh = extractJsonDouble(json, "marginHorizontal", 0.0);
    if (mh > 0) s.marginHorizontal = mh;
    double mt = extractJsonDouble(json, "marginTop", 0.0);
    if (mt > 0) s.marginTop = mt;
    double mb = extractJsonDouble(json, "marginBottom", 0.0);
    if (mb > 0) s.marginBottom = mb;
    double ml = extractJsonDouble(json, "marginLeft", 0.0);
    if (ml > 0) s.marginLeft = ml;
    double mr = extractJsonDouble(json, "marginRight", 0.0);
    if (mr > 0) s.marginRight = mr;
    double p = extractJsonDouble(json, "padding", 0.0);
    if (p > 0) s.padding = p;
    double pv = extractJsonDouble(json, "paddingVertical", 0.0);
    if (pv > 0) s.paddingVertical = pv;
    double ph = extractJsonDouble(json, "paddingHorizontal", 0.0);
    if (ph > 0) s.paddingHorizontal = ph;
    double pt = extractJsonDouble(json, "paddingTop", 0.0);
    if (pt > 0) s.paddingTop = pt;
    double pb = extractJsonDouble(json, "paddingBottom", 0.0);
    if (pb > 0) s.paddingBottom = pb;
    double pl = extractJsonDouble(json, "paddingLeft", 0.0);
    if (pl > 0) s.paddingLeft = pl;
    double pr = extractJsonDouble(json, "paddingRight", 0.0);
    if (pr > 0) s.paddingRight = pr;
    double bw = extractJsonDouble(json, "borderWidth", 0.0);
    if (bw > 0) s.borderWidth = bw;
    std::string bc = extractJsonString(json, "borderColor");
    if (!bc.empty()) s.borderColor = bc;
    double br = extractJsonDouble(json, "borderRadius", 0.0);
    if (br > 0) s.borderRadius = br;
    std::string blc = extractJsonString(json, "borderLeftColor");
    if (!blc.empty()) s.borderLeftColor = blc;
    double blw = extractJsonDouble(json, "borderLeftWidth", 0.0);
    if (blw > 0) s.borderLeftWidth = blw;
    std::string ffs = extractJsonString(json, "fontFeatureSettings");
    if (!ffs.empty()) s.fontFeatureSettings = ffs;
    return s;
}

std::string HybridFastHtmlParser::parseHtmlToJson(
    const std::string& html,
    const std::string& baseStyleJson,
    const std::string& tagsStylesJson
) {
    std::optional<NativeTextStyle> baseStyle = std::nullopt;
    if (!baseStyleJson.empty() && baseStyleJson != "null" && baseStyleJson != "{}") {
        baseStyle = parseStyleObject(baseStyleJson);
    }

    std::optional<std::unordered_map<std::string, NativeTextStyle>> tagsStyles = std::nullopt;
    if (!tagsStylesJson.empty() && tagsStylesJson != "null" && tagsStylesJson != "{}") {
        std::unordered_map<std::string, NativeTextStyle> map;
        // Simple scan for tag objects e.g. "a":{...}, "h1":{...}
        size_t pos = 0;
        while (pos < tagsStylesJson.length()) {
            size_t kStart = tagsStylesJson.find('"', pos);
            if (kStart == std::string::npos) break;
            size_t kEnd = tagsStylesJson.find('"', kStart + 1);
            if (kEnd == std::string::npos) break;
            std::string key = tagsStylesJson.substr(kStart + 1, kEnd - kStart - 1);
            size_t oStart = tagsStylesJson.find('{', kEnd);
            if (oStart == std::string::npos) break;
            size_t oEnd = tagsStylesJson.find('}', oStart);
            if (oEnd == std::string::npos) break;
            std::string objStr = tagsStylesJson.substr(oStart, oEnd - oStart + 1);
            map[key] = parseStyleObject(objStr);
            pos = oEnd + 1;
        }
        if (!map.empty()) {
            tagsStyles = map;
        }
    }

    auto article = parseInternal(html, baseStyle, tagsStyles);
    return articleToJson(article);
}

// ── estimateHeight (Dynamic C++ Lexbor Layout Measurement) ───────────────────
float HybridContentBlock::estimateHeight(float width, float baseFontSize, float baseLineHeight, float fontScale) const {
    float effectiveFontSize = (baseFontSize > 0.0f ? baseFontSize : 16.0f) * (fontScale > 0.0f ? fontScale : 1.0f);
    float effectiveLineHeight = baseLineHeight > 0.0f
        ? (baseLineHeight * (fontScale > 0.0f ? fontScale : 1.0f))
        : (effectiveFontSize * 1.375f);
    float proportionalCharWidth = effectiveFontSize * 0.5f;

    if (type_ == "Heading") {
        float hScale = 1.0f;
        if (level_ == 1) hScale = 2.0f;
        else if (level_ == 2) hScale = 1.5f;
        else if (level_ == 3) hScale = 1.25f;
        else if (level_ == 4) hScale = 1.0f;
        else if (level_ == 5) hScale = 0.875f;
        else if (level_ == 6) hScale = 0.85f;

        float hFontSize = effectiveFontSize * hScale;
        float hLineHeight = hFontSize * 1.25f;
        float hCharWidth = hFontSize * 0.5f;
        float hMargin = hFontSize;

        float textLen = 0.0f;
        for (const auto& child : children_) {
            textLen += static_cast<float>(child->text_.length());
        }
        if (textLen <= 0.0f) return hLineHeight + hMargin;

        float charsPerLine = std::max(1.0f, width / std::max(1.0f, hCharWidth));
        float lines = std::max(1.0f, std::ceil(textLen / charsPerLine));
        return lines * hLineHeight + hMargin;
    }
    if (type_ == "Paragraph") {
        float paragraphMargin = effectiveFontSize;
        float textLen = 0.0f;
        for (const auto& child : children_) {
            textLen += static_cast<float>(child->text_.length());
        }
        if (textLen <= 0.0f) return effectiveLineHeight + paragraphMargin;

        float charsPerLine = std::max(1.0f, width / std::max(1.0f, proportionalCharWidth));
        float lines = std::max(1.0f, std::ceil(textLen / charsPerLine));
        return lines * effectiveLineHeight + paragraphMargin;
    }
    if (type_ == "List") {
        float bulletIndent = effectiveFontSize;
        float itemSpacing = effectiveFontSize;
        float h = 0.0f;

        for (const auto& item : items_) {
            float textLen = 0.0f;
            for (const auto& child : item->children_) {
                textLen += static_cast<float>(child->text_.length());
            }
            float availableWidth = std::max(1.0f, width - bulletIndent);
            float charsPerLine = std::max(1.0f, availableWidth / std::max(1.0f, proportionalCharWidth));
            float lines = std::max(1.0f, std::ceil(textLen / charsPerLine));
            h += lines * effectiveLineHeight + itemSpacing;

            for (const auto& nested : item->nested_) {
                h += nested->estimateHeight(availableWidth, baseFontSize, baseLineHeight, fontScale);
            }
        }
        return h + effectiveFontSize;
    }
    if (type_ == "Table") {
        float rowPadding = effectiveFontSize;
        return static_cast<float>(rows_.size()) * (effectiveLineHeight + rowPadding) + effectiveFontSize;
    }
    if (type_ == "CodeBlock") {
        size_t lines = 1;
        for (char ch : code_) {
            if (ch == '\n') lines++;
        }
        float codeFontSize = effectiveFontSize;
        float codeLineHeight = codeFontSize;
        float codePadding = effectiveFontSize;
        return static_cast<float>(lines) * codeLineHeight + (codePadding + codePadding);
    }
    if (type_ == "Image" || type_ == "Figure") {
        float aspectHeight = width * 0.5625f;
        return std::min(aspectHeight, 240.0f * (fontScale > 0.0f ? fontScale : 1.0f));
    }
    if (type_ == "Video" || type_ == "Audio") {
        float aspectHeight = width * 0.5625f;
        return std::min(aspectHeight, 200.0f * (fontScale > 0.0f ? fontScale : 1.0f));
    }
    if (type_ == "Separator") {
        return effectiveFontSize;
    }
    if (type_ == "DefinitionList") {
        float itemHeight = effectiveLineHeight + effectiveFontSize;
        return static_cast<float>(defItems_.size()) * itemHeight + effectiveFontSize;
    }
    if (type_ == "Blockquote" || type_ == "Quote") {
        float quoteIndent = effectiveFontSize;
        float quotePadding = effectiveFontSize;
        float h = quotePadding;
        for (const auto& qc : quoteChildren_) {
            h += qc->estimateHeight(std::max(1.0f, width - quoteIndent), baseFontSize, baseLineHeight, fontScale);
        }
        return h + quotePadding;
    }
    return effectiveLineHeight + effectiveFontSize;
}

float HybridParsedArticle::estimateHeight(float width, float baseFontSize, float baseLineHeight, float fontScale) const {
    float total = 0.0f;
    for (const auto& block : blocks_) {
        total += block->estimateHeight(width, baseFontSize, baseLineHeight, fontScale);
    }
    float effectiveFontSize = (baseFontSize > 0.0f ? baseFontSize : 16.0f) * (fontScale > 0.0f ? fontScale : 1.0f);
    return std::max(effectiveFontSize, total);
}

double HybridFastHtmlParser::calculateHtmlHeight(const std::string& html, double width, double baseFontSize, double baseLineHeight, double fontScale) {
    return static_cast<double>(calculateHtmlHeight(
        html,
        static_cast<float>(width),
        static_cast<float>(baseFontSize),
        static_cast<float>(baseLineHeight),
        static_cast<float>(fontScale)
    ));
}

float HybridFastHtmlParser::calculateHtmlHeight(const std::string& html, float width, float baseFontSize, float baseLineHeight, float fontScale) {
    if (html.empty()) return 0.0f;
    auto article = parseInternal(html);
    return article ? article->estimateHeight(width, baseFontSize, baseLineHeight, fontScale) : 0.0f;
}

// ── parse (sync) ──────────────────────────────────────────────────────────────
std::variant<std::shared_ptr<HybridParsedArticleSpec>, NullType>
HybridFastHtmlParser::parse(const std::string& html) {
    if (html.empty()) return nullptr;
    auto article = parseInternal(html);
    return article;
}

// ── parseAsync ────────────────────────────────────────────────────────────────
std::shared_ptr<Promise<std::variant<std::shared_ptr<HybridParsedArticleSpec>, NullType>>>
HybridFastHtmlParser::parseAsync(const std::string& html) {
    return Promise<std::variant<std::shared_ptr<HybridParsedArticleSpec>, NullType>>::async([html]() -> std::variant<std::shared_ptr<HybridParsedArticleSpec>, NullType> {
        if (html.empty()) return nullptr;
        return parseInternal(html);
    });
}

// ── normalizeHtml ─────────────────────────────────────────────────────────────
std::string HybridFastHtmlParser::normalizeHtml(const std::string& html) {
    if (html.empty()) return "";

    lxb_html_parser_t* parser = lxb_html_parser_create();
    if (!parser) return html;

    if (lxb_html_parser_init(parser) != LXB_STATUS_OK) {
        lxb_html_parser_destroy(parser);
        return html;
    }

    lxb_html_document_t* document = lxb_html_parse(
        parser,
        reinterpret_cast<const lxb_char_t*>(html.c_str()),
        html.length()
    );

    std::string result;
    if (document) {
        lxb_dom_node_t* targetNode = nullptr;
        if (document->body) {
            targetNode = lxb_dom_interface_node(document->body);
        } else if (document->dom_document.element) {
            targetNode = lxb_dom_interface_node(document->dom_document.element);
        }

        if (targetNode) {
            result = serializeNodeHtml(targetNode);
        }
        lxb_html_document_destroy(document);
    }

    lxb_html_parser_destroy(parser);
    return !result.empty() ? result : html;
}

} // namespace margelo::nitro::fasthtmlparser
