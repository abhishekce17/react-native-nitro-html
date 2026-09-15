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

class FontFeatureSpan(private val rawFeatureSettings: String) : MetricAffectingSpan() {
    private val normalized = SpannableHtmlEngine.normalizeFontFeatureSettings(rawFeatureSettings)
    override fun updateDrawState(tp: TextPaint) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            tp.fontFeatureSettings = normalized
        }
    }
    override fun updateMeasureState(tp: TextPaint) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            tp.fontFeatureSettings = normalized
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
    private val colorCache = java.util.concurrent.ConcurrentHashMap<String, Int>()
    private val nonExistentFontAssets = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

    private var rfmInitialized = false
    private var rfmInstance: Any? = null
    private var rfmGetTypefaceMethod3: java.lang.reflect.Method? = null
    private var rfmGetTypefaceMethod4: java.lang.reflect.Method? = null

    private fun getRfmTypeface(context: Context, name: String, styleInt: Int, weightInt: Int): Typeface? {
        if (!rfmInitialized) {
            try {
                val rfmClass = Class.forName("com.facebook.react.views.text.ReactFontManager")
                val getInstanceMethod = rfmClass.getMethod("getInstance")
                rfmInstance = getInstanceMethod.invoke(null)
                try {
                    rfmGetTypefaceMethod4 = rfmClass.getMethod(
                        "getTypeface",
                        String::class.java,
                        Int::class.javaPrimitiveType,
                        Int::class.javaPrimitiveType,
                        android.content.res.AssetManager::class.java
                    )
                } catch (_: Throwable) {}
                try {
                    rfmGetTypefaceMethod3 = rfmClass.getMethod(
                        "getTypeface",
                        String::class.java,
                        Int::class.javaPrimitiveType,
                        android.content.res.AssetManager::class.java
                    )
                } catch (_: Throwable) {}
            } catch (_: Throwable) {}
            rfmInitialized = true
        }
        return try {
            if (rfmGetTypefaceMethod4 != null) {
                rfmGetTypefaceMethod4?.invoke(rfmInstance, name, styleInt, weightInt, context.assets) as? Typeface
            } else {
                rfmGetTypefaceMethod3?.invoke(rfmInstance, name, styleInt, context.assets) as? Typeface
            }
        } catch (_: Throwable) {
            null
        }
    }

    @JvmStatic
    fun normalizeFontFeatureSettings(ffs: String?): String? {
        if (ffs.isNullOrEmpty()) return null
        val trimmed = ffs.trim()
        if (trimmed.equals("normal", ignoreCase = true) || trimmed.equals("none", ignoreCase = true)) {
            return null
        }
        if (trimmed.contains('"') || trimmed.contains('\'')) {
            return trimmed
        }
        val parts = trimmed.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val normalized = parts.map { part ->
            val tokens = part.split("\\s+".toRegex())
            val tag = tokens[0]
            val value = if (tokens.size > 1) " ${tokens[1]}" else " 1"
            "\"$tag\"$value"
        }
        return normalized.joinToString(", ")
    }

    private fun parseNumericWeight(weight: String?): Int {
        if (weight.isNullOrEmpty()) return 400
        val trimmed = weight.trim().lowercase()
        return when (trimmed) {
            "950", "extrablack", "extra-black" -> 950
            "900", "black", "heavy-black" -> 900
            "800", "heavy", "extrabold", "extra-bold" -> 800
            "700", "bold", "bolder" -> 700
            "600", "semibold", "semi-bold", "demibold", "demi-bold" -> 600
            "500", "medium" -> 500
            "400", "normal", "regular" -> 400
            "300", "light" -> 300
            "200", "ultralight", "extra-light", "extralight" -> 200
            "100", "thin", "hairline" -> 100
            else -> {
                val parsed = trimmed.toIntOrNull()
                if (parsed != null && parsed in 1..1000) parsed else 400
            }
        }
    }

    @JvmStatic
    fun resolveTypeface(context: Context?, family: String?, weight: String?, fontStyle: String?): Typeface {
        val numericWeight = parseNumericWeight(weight)
        val isItalic = fontStyle?.trim()?.lowercase() == "italic"
        val isBold = numericWeight >= 600
        val styleInt = when {
            isBold && isItalic -> Typeface.BOLD_ITALIC
            isBold -> Typeface.BOLD
            isItalic -> Typeface.ITALIC
            else -> Typeface.NORMAL
        }

        val rawFam = family?.trim() ?: ""
        if (rawFam.isEmpty()) {
            return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                Typeface.create(Typeface.SANS_SERIF, numericWeight, isItalic)
            } else {
                Typeface.defaultFromStyle(styleInt)
            }
        }

        val cacheKey = "$rawFam|$numericWeight|$isItalic"
        typefaceCache[cacheKey]?.let { return it }

        val defaultForStyle = Typeface.defaultFromStyle(styleInt)

        val candidates = rawFam.split(",").map { it.trim().trim('\'', '"') }.filter { it.isNotEmpty() }
        var resultTf: Typeface? = null

        for (cand in candidates) {
            val candLower = cand.lowercase()

            if (candLower == "sans-serif" || candLower == "system-ui" || candLower == "system" || candLower == "default") {
                resultTf = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    Typeface.create(Typeface.SANS_SERIF, numericWeight, isItalic)
                } else {
                    Typeface.create(Typeface.SANS_SERIF, styleInt)
                }
                break
            } else if (candLower == "serif") {
                resultTf = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    Typeface.create(Typeface.SERIF, numericWeight, isItalic)
                } else {
                    Typeface.create(Typeface.SERIF, styleInt)
                }
                break
            } else if (candLower == "monospace") {
                resultTf = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    Typeface.create(Typeface.MONOSPACE, numericWeight, isItalic)
                } else {
                    Typeface.create(Typeface.MONOSPACE, styleInt)
                }
                break
            } else if (candLower == "cursive") {
                resultTf = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    Typeface.create(Typeface.SERIF, numericWeight, true)
                } else {
                    Typeface.create(Typeface.SERIF, Typeface.ITALIC)
                }
                break
            } else if (candLower == "fantasy") {
                resultTf = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    Typeface.create(Typeface.SERIF, numericWeight, isItalic)
                } else {
                    Typeface.create(Typeface.SERIF, styleInt)
                }
                break
            }

            // A. React Native ReactFontManager
            if (context != null) {
                val rfmResult = getRfmTypeface(context, cand, styleInt, numericWeight)
                if (rfmResult != null && rfmResult != Typeface.DEFAULT && rfmResult != defaultForStyle) {
                    resultTf = rfmResult
                    break
                }
            }

            // B. Direct asset lookup
            if (context != null) {
                val weightSuffixes = when (numericWeight) {
                    100 -> listOf("-Thin", "-Hairline", "_thin", "_hairline", "Thin", "Hairline", "-100", "100")
                    200 -> listOf("-ExtraLight", "-UltraLight", "_extra_light", "_ultra_light", "ExtraLight", "UltraLight", "-200", "200")
                    300 -> listOf("-Light", "_light", "Light", "-300", "300")
                    400 -> listOf("-Regular", "_regular", "Regular", "-400", "400", "")
                    500 -> listOf("-Medium", "_medium", "Medium", "-500", "500")
                    600 -> listOf("-SemiBold", "-DemiBold", "_semi_bold", "_demi_bold", "SemiBold", "DemiBold", "-600", "600")
                    700 -> listOf("-Bold", "_bold", "Bold", "-700", "700")
                    800 -> listOf("-ExtraBold", "-UltraBold", "-Heavy", "_extra_bold", "_ultra_bold", "_heavy", "ExtraBold", "UltraBold", "Heavy", "-800", "800")
                    900, 950 -> listOf("-Black", "-Heavy", "_black", "_heavy", "Black", "Heavy", "-900", "900")
                    else -> listOf("")
                }

                val nameVariants = linkedSetOf(cand, cand.replace(" ", ""), cand.replace(" ", "_"), cand.replace(" ", "-"))
                val assetPaths = linkedSetOf<String>()

                for (base in nameVariants) {
                    for (ws in weightSuffixes) {
                        if (isItalic) {
                            val italSuffixes = if (ws.isEmpty()) listOf("-Italic", "_italic", "Italic") else listOf("${ws}Italic", "${ws}-Italic", "${ws}_italic", "${ws}_Italic")
                            for (isuf in italSuffixes) {
                                assetPaths.add("fonts/$base$isuf.ttf")
                                assetPaths.add("fonts/$base$isuf.otf")
                                assetPaths.add("$base$isuf.ttf")
                                assetPaths.add("$base$isuf.otf")
                            }
                        }
                        if (ws.isNotEmpty()) {
                            assetPaths.add("fonts/$base$ws.ttf")
                            assetPaths.add("fonts/$base$ws.otf")
                            assetPaths.add("$base$ws.ttf")
                            assetPaths.add("$base$ws.otf")
                        }
                    }
                    assetPaths.add("fonts/$base.ttf")
                    assetPaths.add("fonts/$base.otf")
                    assetPaths.add("$base.ttf")
                    assetPaths.add("$base.otf")
                }

                for (ap in assetPaths) {
                    if (nonExistentFontAssets.contains(ap)) continue
                    try {
                        val assetTf = Typeface.createFromAsset(context.assets, ap)
                        if (assetTf != null) {
                            resultTf = assetTf
                            break
                        }
                    } catch (_: Throwable) {
                        nonExistentFontAssets.add(ap)
                    }
                }
                if (resultTf != null) break
            }

            // C. System font lookup
            try {
                val created = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    val baseSys = Typeface.create(cand, Typeface.NORMAL)
                    if (baseSys != null && baseSys != Typeface.DEFAULT && baseSys != defaultForStyle) {
                        Typeface.create(baseSys, numericWeight, isItalic)
                    } else null
                } else {
                    val baseSys = Typeface.create(cand, styleInt)
                    if (baseSys != null && baseSys != Typeface.DEFAULT && baseSys != defaultForStyle) baseSys else null
                }
                if (created != null) {
                    resultTf = created
                    break
                }
            } catch (_: Throwable) {}
        }

        val finalTf = resultTf ?: if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            Typeface.create(Typeface.SANS_SERIF, numericWeight, isItalic)
        } else {
            Typeface.defaultFromStyle(styleInt)
        }

        typefaceCache[cacheKey] = finalTf
        return finalTf
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
        baseStyleJson: String = "",
        tagsStylesJson: String = ""
    ): String

    @JvmStatic
    external fun nativeParseAstIdToJson(
        astId: String,
        baseStyleJson: String = "",
        tagsStylesJson: String = ""
    ): String

    private fun parseColor(hex: String?): Int? {
        if (hex.isNullOrEmpty()) return null
        colorCache[hex]?.let { return it }
        return try {
            val parsed = Color.parseColor(hex)
            colorCache[hex] = parsed
            parsed
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
        astId: String? = null,
        html: String? = null
    ): JSONArray {
        val jsonStr = try {
            if (!astId.isNullOrEmpty()) {
                val res = nativeParseAstIdToJson(astId, "", "")
                if (res != "[]" || html.isNullOrEmpty()) {
                    res
                } else {
                    nativeParseHtmlToJson(html, "", "")
                }
            } else if (!html.isNullOrEmpty()) {
                nativeParseHtmlToJson(html, "", "")
            } else {
                "[]"
            }
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
                val listMl = blockObj.optDouble("marginLeft")
                val listPl = blockObj.optDouble("paddingLeft")
                val baseLeftIndent = ((listMl + listPl) * density).toInt()
                val hangingIndent = if (ordered) (20 * density).toInt() else (16 * density).toInt()

                if (items != null) {
                    for (li in 0 until items.length()) {
                        val itemObj = items.optJSONObject(li) ?: continue
                        val itemStart = blockBuilder.length
                        val prefix = if (ordered) "${li + 1}. " else "• "
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
                        val isBold = weight == "bold" || weight == "700" || weight == "800" || weight == "900" || weight == "600" || weight == "semibold"
                        val isItalic = style == "italic"
                        if (family.isNotEmpty()) {
                            blockBuilder.setSpan(
                                CustomTypefaceSpan(family, weight, style, context),
                                pStart,
                                pEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        } else if (isBold && isItalic) {
                            blockBuilder.setSpan(StyleSpan(Typeface.BOLD_ITALIC), pStart, pEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
                        } else if (isBold) {
                            blockBuilder.setSpan(StyleSpan(Typeface.BOLD), pStart, pEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
                        } else if (isItalic) {
                            blockBuilder.setSpan(StyleSpan(Typeface.ITALIC), pStart, pEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
                        }

                        val itemChildren = itemObj.optJSONArray("children")
                        if (itemChildren != null) {
                            for (ic in 0 until itemChildren.length()) {
                                val itemChildObj = itemChildren.optJSONObject(ic) ?: continue
                                appendInlineNode(blockBuilder, itemChildObj, onLinkPress, context)
                            }
                        }

                        val itemContentEnd = blockBuilder.length
                        if (li < items.length() - 1) {
                            val spacerStart = blockBuilder.length
                            blockBuilder.append("\n\n")
                            val spacerEnd = blockBuilder.length
                            val liSpacingPx = (6 * density).toInt()
                            blockBuilder.setSpan(
                                AbsoluteSizeSpan(liSpacingPx, false),
                                spacerStart + 1,
                                spacerEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                            blockBuilder.setSpan(
                                LeadingMarginSpan.Standard(baseLeftIndent, baseLeftIndent + hangingIndent),
                                itemStart,
                                spacerStart + 1,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                        } else {
                            blockBuilder.setSpan(
                                LeadingMarginSpan.Standard(baseLeftIndent, baseLeftIndent + hangingIndent),
                                itemStart,
                                itemContentEnd,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )
                            val listMb = blockObj.optDouble("marginBottom", 0.0)
                            if (listMb > 0) {
                                val spacerStart = blockBuilder.length
                                blockBuilder.append("\n\n")
                                val spacerEnd = blockBuilder.length
                                val mbPx = (listMb * density).toInt()
                                blockBuilder.setSpan(
                                    AbsoluteSizeSpan(mbPx, false),
                                    spacerStart + 1,
                                    spacerEnd,
                                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                                )
                            }
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
                val blw = blockObj.optDouble("borderLeftWidth")
                val blc = blockObj.optString("borderLeftColor")
                val hasBorderLeft = (blw > 0 && blc.isNotEmpty())
                if (blockType != "List") {
                    val ml = blockObj.optDouble("marginLeft")
                    val pl = blockObj.optDouble("paddingLeft")
                    val ti = blockObj.optDouble("textIndent")
                    val effectivePl = if (hasBorderLeft) 0.0 else pl
                    val restIndent = ((ml + effectivePl) * density).toInt()
                    val firstLineIndent = ((ml + effectivePl + ti) * density).toInt()
                    if (restIndent > 0 || firstLineIndent > 0) {
                        blockBuilder.setSpan(
                            LeadingMarginSpan.Standard(firstLineIndent, restIndent),
                            0,
                            blockBuilder.length,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }
                }
                if (hasBorderLeft) {
                    parseColor(blc)?.let {
                        val stripePx = (blw * density).toInt()
                        val pl = blockObj.optDouble("paddingLeft")
                        val gapPx = if (pl > 0) (pl * density).toInt() else (10 * density).toInt()
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                            blockBuilder.setSpan(
                                QuoteSpan(it, stripePx, gapPx),
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
        astId: String? = null,
        html: String? = null,
        onLinkPress: ((url: String) -> Unit)? = null
    ): CharSequence {
        val blocks = parseJson(astId = astId, html = html)
        return buildSpannableFromBlocks(context, blocks, onLinkPress)
    }
}
