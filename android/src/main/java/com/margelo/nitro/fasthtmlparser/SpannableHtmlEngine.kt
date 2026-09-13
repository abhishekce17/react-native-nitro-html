package com.margelo.nitro.fasthtmlparser

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.TextPaint
import android.text.style.*
import android.view.View
import org.json.JSONArray
import org.json.JSONObject

class BlockBackgroundSpan(
    private val backgroundColor: Int,
    private val borderRadiusPx: Float = 0f,
    private val marginLeftPx: Float = 0f,
    private val marginRightPx: Float = 0f
) : LineBackgroundSpan {
    private val rect = RectF()

    override fun drawBackground(
        canvas: Canvas,
        paint: Paint,
        left: Int,
        right: Int,
        top: Int,
        baseline: Int,
        bottom: Int,
        text: CharSequence,
        start: Int,
        end: Int,
        lineNumber: Int
    ) {
        val prevColor = paint.color
        paint.color = backgroundColor
        rect.set(
            left.toFloat() + marginLeftPx,
            top.toFloat(),
            right.toFloat() - marginRightPx,
            bottom.toFloat()
        )
        if (borderRadiusPx > 0f) {
            canvas.drawRoundRect(rect, borderRadiusPx, borderRadiusPx, paint)
        } else {
            canvas.drawRect(rect, paint)
        }
        paint.color = prevColor
    }
}

class FontFeatureSpan(private val featureSettings: String) : MetricAffectingSpan() {
    override fun updateDrawState(tp: TextPaint) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            tp.fontFeatureSettings = featureSettings
        }
    }
    override fun updateMeasureState(tp: TextPaint) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            tp.fontFeatureSettings = featureSettings
        }
    }
}

class CustomTypefaceSpan(
    private val family: String,
    private val weight: String = "",
    private val fontStyle: String = "",
    private val context: Context? = null
) : MetricAffectingSpan() {
    override fun updateDrawState(tp: TextPaint) {
        tp.typeface = SpannableHtmlEngine.resolveTypeface(context, family, weight, fontStyle)
    }
    override fun updateMeasureState(tp: TextPaint) {
        tp.typeface = SpannableHtmlEngine.resolveTypeface(context, family, weight, fontStyle)
    }
}

object SpannableHtmlEngine {

    private val typefaceCache = java.util.concurrent.ConcurrentHashMap<String, Typeface>()

    @JvmStatic
    fun resolveTypeface(context: Context?, family: String?, weight: String?, fontStyle: String?): Typeface {
        val isBold = weight == "bold" || weight == "700" || weight == "800" || weight == "900" || weight == "600" || weight == "semibold" || weight == "semi-bold" || weight == "heavy" || weight == "black"
        val isItalic = fontStyle == "italic"
        val styleInt = when {
            isBold && isItalic -> Typeface.BOLD_ITALIC
            isBold -> Typeface.BOLD
            isItalic -> Typeface.ITALIC
            else -> Typeface.NORMAL
        }

        val rawFam = family?.trim() ?: ""
        if (rawFam.isEmpty()) {
            return Typeface.defaultFromStyle(styleInt)
        }

        val cacheKey = "$rawFam|$weight|$fontStyle"
        typefaceCache[cacheKey]?.let { return it }

        val defaultForStyle = Typeface.defaultFromStyle(styleInt)

        val candidates = rawFam.split(",").map { it.trim().trim('\'', '"') }.filter { it.isNotEmpty() }
        for (cand in candidates) {
            val lower = cand.lowercase()
            val tf: Typeface? = when (lower) {
                "monospace" -> Typeface.create(Typeface.MONOSPACE, styleInt)
                "serif" -> Typeface.create(Typeface.SERIF, styleInt)
                "sans-serif", "system-ui", "system" -> Typeface.create(Typeface.SANS_SERIF, styleInt)
                "cursive" -> Typeface.create(Typeface.SERIF, Typeface.ITALIC)
                "fantasy" -> Typeface.create(Typeface.SERIF, styleInt)
                else -> {
                    // 1. Resolve via React Native ReactFontManager (handles any custom font registered or placed in assets)
                    var loaded: Typeface? = null
                    var isCustomAsset = false
                    if (context != null) {
                        try {
                            val rfmClass = Class.forName("com.facebook.react.views.text.ReactFontManager")
                            val getInstanceMethod = rfmClass.getMethod("getInstance")
                            val instance = getInstanceMethod.invoke(null)
                            val getTypefaceMethod = rfmClass.getMethod(
                                "getTypeface",
                                String::class.java,
                                Int::class.javaPrimitiveType,
                                android.content.res.AssetManager::class.java
                            )
                            val rfmResult = getTypefaceMethod.invoke(instance, cand, styleInt, context.assets) as? Typeface
                            if (rfmResult != null && rfmResult != Typeface.DEFAULT && rfmResult != defaultForStyle) {
                                loaded = rfmResult
                                isCustomAsset = true
                            }
                        } catch (_: Throwable) {}
                    }

                    // 2. Direct asset search in fonts/ and root assets (including weight & style variant suffixes)
                    if (loaded == null && context != null) {
                        val assetPaths = linkedSetOf(
                            "fonts/$cand.ttf", "fonts/$cand.otf",
                            "$cand.ttf", "$cand.otf"
                        )
                        if (isBold && isItalic) {
                            assetPaths.addAll(listOf(
                                "fonts/${cand}-BoldItalic.ttf", "fonts/${cand}-BoldItalic.otf",
                                "fonts/${cand}_bold_italic.ttf", "fonts/${cand}_bold_italic.otf",
                                "fonts/${cand}BoldItalic.ttf", "fonts/${cand}BoldItalic.otf",
                                "fonts/${cand}-Bold.ttf", "fonts/${cand}-Bold.otf"
                            ))
                        } else if (isBold) {
                            assetPaths.addAll(listOf(
                                "fonts/${cand}-Bold.ttf", "fonts/${cand}-Bold.otf",
                                "fonts/${cand}_bold.ttf", "fonts/${cand}_bold.otf",
                                "fonts/${cand}Bold.ttf", "fonts/${cand}Bold.otf"
                            ))
                        } else if (isItalic) {
                            assetPaths.addAll(listOf(
                                "fonts/${cand}-Italic.ttf", "fonts/${cand}-Italic.otf",
                                "fonts/${cand}_italic.ttf", "fonts/${cand}_italic.otf",
                                "fonts/${cand}Italic.ttf", "fonts/${cand}Italic.otf"
                            ))
                        }
                        assetPaths.addAll(listOf(
                            "fonts/${cand}-Regular.ttf", "fonts/${cand}-Regular.otf",
                            "fonts/${cand}_regular.ttf", "fonts/${cand}_regular.otf",
                            "fonts/${cand}Regular.ttf", "fonts/${cand}Regular.otf"
                        ))

                        if (cand.contains("-") || cand.contains("_")) {
                            val baseName = cand.split("-", "_")[0]
                            assetPaths.addAll(listOf(
                                "fonts/$baseName.ttf", "fonts/$baseName.otf",
                                "fonts/${baseName}-Bold.ttf", "fonts/${baseName}-Bold.otf",
                                "fonts/${baseName}-Regular.ttf", "fonts/${baseName}-Regular.otf"
                            ))
                        }

                        for (ap in assetPaths) {
                            try {
                                val assetTf = Typeface.createFromAsset(context.assets, ap)
                                if (assetTf != null) {
                                    loaded = assetTf
                                    isCustomAsset = true
                                    break
                                }
                            } catch (_: Throwable) {}
                        }
                    }

                    // 3. System installed font lookup
                    if (loaded == null) {
                        try {
                            val created = Typeface.create(cand, styleInt)
                            if (created != null && created != Typeface.DEFAULT && created != defaultForStyle) {
                                loaded = created
                            } else if (created != null && (lower == "roboto" || lower.contains("sans"))) {
                                loaded = created
                            }
                        } catch (_: Throwable) {}
                    }

                    // 4. Apply fine-grained numeric weight on Android P+ (API 28+) ONLY for system fonts
                    if (loaded != null && !isCustomAsset && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P && !weight.isNullOrEmpty()) {
                        try {
                            val numericWeight = when (weight.lowercase()) {
                                "900", "black" -> 900
                                "800", "heavy" -> 800
                                "700", "bold" -> 700
                                "600", "semibold", "semi-bold" -> 600
                                "500", "medium" -> 500
                                "400", "normal", "regular" -> 400
                                "300", "light" -> 300
                                "200", "ultralight", "extra-light" -> 200
                                "100", "thin" -> 100
                                else -> 400
                            }
                            val styled = Typeface.create(loaded, numericWeight, isItalic)
                            if (styled != null && (styled != Typeface.DEFAULT || loaded == Typeface.DEFAULT)) {
                                loaded = styled
                            }
                        } catch (_: Throwable) {}
                    }
                    loaded
                }
            }
            if (tf != null) {
                typefaceCache[cacheKey] = tf
                return tf
            }
        }

        typefaceCache[cacheKey] = defaultForStyle
        return defaultForStyle
    }

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
        style.fontFeatureSettings?.let { obj.put("fontFeatureSettings", it) }
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
        onLinkPress: ((url: String) -> Unit)?,
        context: Context? = null
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
                appendInlineNode(builder, childObj, onLinkPress, context)
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
            val weight = nodeObj.optString("fontWeight")
            val style = nodeObj.optString("fontStyle")
            val isBold = weight == "bold" || weight == "700" || weight == "800" || weight == "900" || weight == "600" || weight == "semibold"
            val isItalic = style == "italic"

            if (family.isNotEmpty()) {
                builder.setSpan(
                    CustomTypefaceSpan(family, weight, style, context),
                    start,
                    end,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            } else if (isBold && isItalic) {
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

            val ffs = nodeObj.optString("fontFeatureSettings")
            if (ffs.isNotEmpty()) {
                builder.setSpan(
                    FontFeatureSpan(ffs),
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
        onLinkPress: ((url: String) -> Unit)? = null,
        context: Context? = null
    ): CharSequence {
        val builder = SpannableStringBuilder()
        val children = cellObj.optJSONArray("children")
        if (children != null) {
            for (c in 0 until children.length()) {
                val childObj = children.optJSONObject(c) ?: continue
                appendInlineNode(builder, childObj, onLinkPress, context)
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
                    appendInlineNode(blockBuilder, childObj, onLinkPress, context)
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
                    val family = blockObj.optString("fontFamily").ifEmpty { "monospace" }
                    val weight = blockObj.optString("fontWeight")
                    val style = blockObj.optString("fontStyle")
                    blockBuilder.setSpan(
                        CustomTypefaceSpan(family, weight, style, context),
                        cStart,
                        cEnd,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                    val ffs = blockObj.optString("fontFeatureSettings")
                    if (ffs.isNotEmpty()) {
                        blockBuilder.setSpan(
                            FontFeatureSpan(ffs),
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
                        val family = blockObj.optString("fontFamily")
                        val weight = blockObj.optString("fontWeight")
                        val style = blockObj.optString("fontStyle")
                        if (family.isNotEmpty()) {
                            blockBuilder.setSpan(
                                CustomTypefaceSpan(family, weight, style, context),
                                pStart,
                                pEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        }

                        val itemChildren = itemObj.optJSONArray("children")
                        if (itemChildren != null) {
                            for (ic in 0 until itemChildren.length()) {
                                val itemChildObj = itemChildren.optJSONObject(ic) ?: continue
                                appendInlineNode(blockBuilder, itemChildObj, onLinkPress, context)
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
                        val br = blockObj.optDouble("borderRadius").let { if (it > 0) (it * density).toFloat() else 0f }
                        val ml = blockObj.optDouble("marginLeft").let { if (it > 0) (it * density).toFloat() else 0f }
                        val mr = blockObj.optDouble("marginRight").let { if (it > 0) (it * density).toFloat() else 0f }
                        blockBuilder.setSpan(
                            BlockBackgroundSpan(it, br, ml, mr),
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
