package com.margelo.nitro.fasthtmlparser

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.TextPaint
import android.text.style.*
import android.view.View
import org.json.JSONArray
import org.json.JSONObject

object SpannableHtmlEngine {

    init {
        try {
            System.loadLibrary("fasthtmlparser")
        } catch (_: UnsatisfiedLinkError) {
        }
    }

    @JvmStatic
    external fun nativeParseHtmlToJson(
        html: String,
        baseStyleJson: String,
        tagsStylesJson: String
    ): String

    private fun nativeTextStyleToJson(style: NativeTextStyle?): String {
        if (style == null) return "{}"
        val obj = JSONObject()
        style.fontSize?.let { obj.put("fontSize", it) }
        style.color?.let { obj.put("color", it) }
        style.backgroundColor?.let { obj.put("backgroundColor", it) }
        style.fontFamily?.let { obj.put("fontFamily", it) }
        style.fontWeight?.let { obj.put("fontWeight", it) }
        style.fontStyle?.let { obj.put("fontStyle", it) }
        style.lineHeight?.let { obj.put("lineHeight", it) }
        style.letterSpacing?.let { obj.put("letterSpacing", it) }
        style.textAlign?.let { obj.put("textAlign", it) }
        style.textTransform?.let { obj.put("textTransform", it) }
        style.textIndent?.let { obj.put("textIndent", it) }
        style.textDecorationLine?.let { obj.put("textDecorationLine", it) }
        style.textDecorationColor?.let { obj.put("textDecorationColor", it) }
        style.textDecorationStyle?.let { obj.put("textDecorationStyle", it) }
        style.opacity?.let { obj.put("opacity", it) }
        style.margin?.let { obj.put("margin", it) }
        style.marginVertical?.let { obj.put("marginVertical", it) }
        style.marginHorizontal?.let { obj.put("marginHorizontal", it) }
        style.marginTop?.let { obj.put("marginTop", it) }
        style.marginBottom?.let { obj.put("marginBottom", it) }
        style.marginLeft?.let { obj.put("marginLeft", it) }
        style.marginRight?.let { obj.put("marginRight", it) }
        style.padding?.let { obj.put("padding", it) }
        style.paddingVertical?.let { obj.put("paddingVertical", it) }
        style.paddingHorizontal?.let { obj.put("paddingHorizontal", it) }
        style.paddingTop?.let { obj.put("paddingTop", it) }
        style.paddingBottom?.let { obj.put("paddingBottom", it) }
        style.paddingLeft?.let { obj.put("paddingLeft", it) }
        style.paddingRight?.let { obj.put("paddingRight", it) }
        style.borderWidth?.let { obj.put("borderWidth", it) }
        style.borderColor?.let { obj.put("borderColor", it) }
        style.borderRadius?.let { obj.put("borderRadius", it) }
        style.borderLeftColor?.let { obj.put("borderLeftColor", it) }
        style.borderLeftWidth?.let { obj.put("borderLeftWidth", it) }
        return obj.toString()
    }

    private fun tagsStylesToJson(styles: Map<String, NativeTextStyle>?): String {
        if (styles == null) return "{}"
        val obj = JSONObject()
        for ((k, v) in styles) {
            val sub = JSONObject(nativeTextStyleToJson(v))
            obj.put(k, sub)
        }
        return obj.toString()
    }

    private fun parseColor(hex: String?): Int? {
        if (hex.isNullOrEmpty()) return null
        return try {
            Color.parseColor(hex)
        } catch (_: Exception) {
            null
        }
    }

    private fun appendInlineNode(
        builder: SpannableStringBuilder,
        nodeObj: JSONObject,
        onLinkPress: ((url: String) -> Unit)?
    ) {
        val type = nodeObj.optString("type")
        if (type == "Break") {
            builder.append("\n")
            return
        }

        val text = nodeObj.optString("text")
        val start = builder.length
        if (text.isNotEmpty()) {
            builder.append(text)
        }

        val children = nodeObj.optJSONArray("children")
        if (children != null) {
            for (c in 0 until children.length()) {
                val childObj = children.optJSONObject(c) ?: continue
                appendInlineNode(builder, childObj, onLinkPress)
            }
        }

        val end = builder.length
        if (end > start) {
            val fontSize = nodeObj.optDouble("fontSize")
            if (fontSize > 0) {
                builder.setSpan(
                    AbsoluteSizeSpan(fontSize.toInt(), true),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            val colorStr = nodeObj.optString("color")
            if (colorStr.isNotEmpty()) {
                parseColor(colorStr)?.let {
                    val opacity = nodeObj.optDouble("opacity", 1.0)
                    val finalColor = if (opacity < 1.0) {
                        val alpha = (Color.alpha(it) * opacity).toInt()
                        Color.argb(alpha, Color.red(it), Color.green(it), Color.blue(it))
                    } else {
                        it
                    }
                    builder.setSpan(
                        ForegroundColorSpan(finalColor),
                        start,
                        end,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
            }

            val bgStr = nodeObj.optString("backgroundColor")
            if (bgStr.isNotEmpty()) {
                parseColor(bgStr)?.let {
                    builder.setSpan(
                        BackgroundColorSpan(it),
                        start,
                        end,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
            }

            val family = nodeObj.optString("fontFamily")
            if (family.isNotEmpty()) {
                builder.setSpan(
                    TypefaceSpan(family),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            val weight = nodeObj.optString("fontWeight")
            val isBold = weight == "bold" || weight == "700" || weight == "800" || weight == "900" || weight == "600" || weight == "semibold"
            val style = nodeObj.optString("fontStyle")
            val isItalic = style == "italic"

            if (isBold && isItalic) {
                builder.setSpan(
                    StyleSpan(Typeface.BOLD_ITALIC),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            } else if (isBold) {
                builder.setSpan(
                    StyleSpan(Typeface.BOLD),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            } else if (isItalic) {
                builder.setSpan(
                    StyleSpan(Typeface.ITALIC),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            if (nodeObj.optBoolean("isUnderline")) {
                builder.setSpan(
                    UnderlineSpan(),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            if (nodeObj.optBoolean("isStrikethrough")) {
                builder.setSpan(
                    StrikethroughSpan(),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            val isLink = nodeObj.optBoolean("isLink")
            val url = nodeObj.optString("url")
            if (isLink && url.isNotEmpty()) {
                val linkColorInt = if (colorStr.isNotEmpty()) parseColor(colorStr) else null
                val isUnderline = nodeObj.optBoolean("isUnderline")
                builder.setSpan(
                    object : ClickableSpan() {
                        override fun onClick(widget: View) {
                            onLinkPress?.invoke(url)
                        }

                        override fun updateDrawState(ds: TextPaint) {
                            if (linkColorInt != null) {
                                ds.color = linkColorInt
                            } else {
                                super.updateDrawState(ds)
                            }
                            ds.isUnderlineText = isUnderline
                        }
                    },
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            val baseline = nodeObj.optDouble("baselineShift")
            if (baseline > 0) {
                builder.setSpan(
                    SuperscriptSpan(),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            } else if (baseline < 0) {
                builder.setSpan(
                    SubscriptSpan(),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }
        }
    }

    fun parseJson(
        html: String,
        baseStyle: NativeTextStyle? = null,
        tagsStyles: Map<String, NativeTextStyle>? = null
    ): JSONArray {
        if (html.isEmpty()) return JSONArray()
        val baseJson = nativeTextStyleToJson(baseStyle)
        val tagsJson = tagsStylesToJson(tagsStyles)
        val jsonStr = try {
            nativeParseHtmlToJson(html, baseJson, tagsJson)
        } catch (_: Exception) {
            "[]"
        }
        return try {
            JSONArray(jsonStr)
        } catch (_: Exception) {
            JSONArray()
        }
    }

    fun buildCellSpannable(
        cellObj: JSONObject,
        onLinkPress: ((url: String) -> Unit)? = null
    ): CharSequence {
        val builder = SpannableStringBuilder()
        val children = cellObj.optJSONArray("children")
        if (children != null) {
            for (c in 0 until children.length()) {
                val childObj = children.optJSONObject(c) ?: continue
                appendInlineNode(builder, childObj, onLinkPress)
            }
        }
        return builder
    }

    fun buildSpannableFromBlocks(
        context: Context,
        blocks: JSONArray,
        onLinkPress: ((url: String) -> Unit)? = null
    ): SpannableStringBuilder {
        val fullBuilder = SpannableStringBuilder()
        val density = context.resources.displayMetrics.density

        for (i in 0 until blocks.length()) {
            val blockObj = blocks.optJSONObject(i) ?: continue
            val blockBuilder = SpannableStringBuilder()

            val children = blockObj.optJSONArray("children")
            if (children != null) {
                for (c in 0 until children.length()) {
                    val childObj = children.optJSONObject(c) ?: continue
                    appendInlineNode(blockBuilder, childObj, onLinkPress)
                }
            }

            val blockType = blockObj.optString("type")
            if (blockType == "CodeBlock") {
                val code = blockObj.optString("code")
                if (code.isNotEmpty()) {
                    val cStart = blockBuilder.length
                    blockBuilder.append(code)
                    val cEnd = blockBuilder.length
                    val fs = blockObj.optDouble("fontSize")
                    if (fs > 0) {
                        blockBuilder.setSpan(
                            AbsoluteSizeSpan(fs.toInt(), true),
                            cStart,
                            cEnd,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }
                    val family = blockObj.optString("fontFamily")
                    if (family == "monospace") {
                        blockBuilder.setSpan(
                            TypefaceSpan("monospace"),
                            cStart,
                            cEnd,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }
                    val colorStr = blockObj.optString("color")
                    if (colorStr.isNotEmpty()) {
                        parseColor(colorStr)?.let {
                            blockBuilder.setSpan(
                                ForegroundColorSpan(it),
                                cStart,
                                cEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        }
                    }
                    val bgStr = blockObj.optString("backgroundColor")
                    if (bgStr.isNotEmpty()) {
                        parseColor(bgStr)?.let {
                            blockBuilder.setSpan(
                                BackgroundColorSpan(it),
                                cStart,
                                cEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        }
                    }
                }
            }

            if (blockType == "List") {
                val items = blockObj.optJSONArray("items")
                val ordered = blockObj.optBoolean("ordered")
                if (items != null) {
                    for (li in 0 until items.length()) {
                        val itemObj = items.optJSONObject(li) ?: continue
                        val prefix = if (ordered) "${li + 1}.  " else "•  "
                        val pStart = blockBuilder.length
                        blockBuilder.append(prefix)
                        val pEnd = blockBuilder.length
                        val fs = blockObj.optDouble("fontSize")
                        if (fs > 0) {
                            blockBuilder.setSpan(
                                AbsoluteSizeSpan(fs.toInt(), true),
                                pStart,
                                pEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        }
                        val colorStr = blockObj.optString("color")
                        if (colorStr.isNotEmpty()) {
                            parseColor(colorStr)?.let {
                                blockBuilder.setSpan(
                                    ForegroundColorSpan(it),
                                    pStart,
                                    pEnd,
                                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                                )
                            }
                        }

                        val itemChildren = itemObj.optJSONArray("children")
                        if (itemChildren != null) {
                            for (ic in 0 until itemChildren.length()) {
                                val itemChildObj = itemChildren.optJSONObject(ic) ?: continue
                                appendInlineNode(blockBuilder, itemChildObj, onLinkPress)
                            }
                        }
                        if (li < items.length() - 1) {
                            blockBuilder.append("\n")
                        }
                    }
                }
            }

            if (blockBuilder.isNotEmpty()) {
                val bgStr = blockObj.optString("backgroundColor")
                if (bgStr.isNotEmpty()) {
                    parseColor(bgStr)?.let {
                        blockBuilder.setSpan(
                            BackgroundColorSpan(it),
                            0,
                            blockBuilder.length,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }
                }
                val lineHeight = blockObj.optDouble("lineHeight")
                if (lineHeight > 0 && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    val lhPx = (lineHeight * density).toInt()
                    blockBuilder.setSpan(
                        LineHeightSpan.Standard(lhPx),
                        0,
                        blockBuilder.length,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
                val alignStr = blockObj.optString("textAlign")
                if (alignStr.isNotEmpty()) {
                    val align = when (alignStr) {
                        "center" -> android.text.Layout.Alignment.ALIGN_CENTER
                        "right" -> android.text.Layout.Alignment.ALIGN_OPPOSITE
                        else -> android.text.Layout.Alignment.ALIGN_NORMAL
                    }
                    blockBuilder.setSpan(
                        AlignmentSpan.Standard(align),
                        0,
                        blockBuilder.length,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
                val ml = blockObj.optDouble("marginLeft")
                val pl = blockObj.optDouble("paddingLeft")
                val ti = blockObj.optDouble("textIndent")
                val restIndent = ((ml + pl) * density).toInt()
                val firstLineIndent = ((ml + pl + ti) * density).toInt()
                if (restIndent > 0 || firstLineIndent > 0) {
                    blockBuilder.setSpan(
                        LeadingMarginSpan.Standard(firstLineIndent, restIndent),
                        0,
                        blockBuilder.length,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
                val blw = blockObj.optDouble("borderLeftWidth")
                val blc = blockObj.optString("borderLeftColor")
                if (blw > 0 && blc.isNotEmpty()) {
                    parseColor(blc)?.let {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                            blockBuilder.setSpan(
                                QuoteSpan(it, (blw * density).toInt(), (8 * density).toInt()),
                                0,
                                blockBuilder.length,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        } else {
                            blockBuilder.setSpan(
                                QuoteSpan(it),
                                0,
                                blockBuilder.length,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        }
                    }
                }

                // Handle marginTop for block if i > 0
                val marginTop = blockObj.optDouble("marginTop")
                if (i > 0 && marginTop > 0) {
                    val topSpacerStart = fullBuilder.length
                    fullBuilder.append("\n")
                    val topSpacerEnd = fullBuilder.length
                    val mtPx = (marginTop * density).toInt()
                    fullBuilder.setSpan(
                        AbsoluteSizeSpan(mtPx, false),
                        topSpacerStart,
                        topSpacerEnd,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }

                fullBuilder.append(blockBuilder)

                if (i < blocks.length() - 1) {
                    val marginBottom = blockObj.optDouble("marginBottom")
                    if (marginBottom > 0) {
                        val spacerStart = fullBuilder.length
                        fullBuilder.append("\n\n")
                        val spacerEnd = fullBuilder.length
                        val marginPx = (marginBottom * density).toInt()
                        fullBuilder.setSpan(
                            AbsoluteSizeSpan(marginPx, false),
                            spacerStart + 1,
                            spacerEnd,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    } else {
                        fullBuilder.append("\n")
                    }
                }
            }
        }

        return fullBuilder
    }

    fun buildSpannable(
        context: Context,
        html: String,
        baseStyle: NativeTextStyle? = null,
        tagsStyles: Map<String, NativeTextStyle>? = null,
        onLinkPress: ((url: String) -> Unit)? = null
    ): CharSequence {
        val blocks = parseJson(html, baseStyle, tagsStyles)
        return buildSpannableFromBlocks(context, blocks, onLinkPress)
    }
}
