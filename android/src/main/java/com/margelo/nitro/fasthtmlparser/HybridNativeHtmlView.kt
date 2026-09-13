package com.margelo.nitro.fasthtmlparser

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.text.method.LinkMovementMethod
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import com.margelo.nitro.NitroModules
import org.json.JSONArray

class HybridNativeHtmlView(
    private val context: Context = NitroModules.applicationContext
        ?: throw IllegalStateException("NitroModules.applicationContext is null")
) : HybridNativeHtmlViewSpec() {

    private val containerLayout: LinearLayout by lazy {
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setBackgroundColor(Color.TRANSPARENT)
        }
    }

    override val view: View
        get() = containerLayout

    private var isUpdateScheduled = false
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    override var html: String? = null
        set(value) {
            field = value
            setNeedsContentUpdate()
        }

    override var baseStyle: NativeTextStyle? = null
        set(value) {
            field = value
            setNeedsContentUpdate()
        }

    override var tagsStyles: Map<String, NativeTextStyle>? = null
        set(value) {
            field = value
            setNeedsContentUpdate()
        }

    override var selectable: Boolean? = true
        set(value) {
            field = value
            updateSelectableRecursive(containerLayout, value ?: true)
        }

    private fun updateSelectableRecursive(v: View, sel: Boolean) {
        if (v is TextView) {
            v.setTextIsSelectable(sel)
        } else if (v is ViewGroup) {
            for (i in 0 until v.childCount) {
                updateSelectableRecursive(v.getChildAt(i), sel)
            }
        }
    }

    override var themeMode: String? = null
        set(value) {
            field = value
            setNeedsContentUpdate()
        }

    override var onLinkPress: ((url: String) -> Unit)? = null
        set(value) {
            field = value
            setNeedsContentUpdate()
        }

    override var onContentSizeChange: ((height: Double) -> Unit)? = null

    private fun setNeedsContentUpdate() {
        if (isUpdateScheduled) return
        isUpdateScheduled = true
        mainHandler.post {
            isUpdateScheduled = false
            updateContent()
        }
    }

    override fun getTextContent(): String {
        val sb = StringBuilder()
        fun collectText(v: View) {
            if (v is TextView) {
                if (sb.isNotEmpty()) sb.append("\n")
                sb.append(v.text)
            } else if (v is ViewGroup) {
                for (i in 0 until v.childCount) {
                    collectText(v.getChildAt(i))
                }
            }
        }
        collectText(containerLayout)
        return sb.toString()
    }

    private fun updateContent() {
        val rawHtml = html ?: ""
        containerLayout.removeAllViews()
        if (rawHtml.isEmpty()) {
            onContentSizeChange?.invoke(0.0)
            return
        }

        val blocks = SpannableHtmlEngine.parseJson(rawHtml, baseStyle, tagsStyles)
        val density = context.resources.displayMetrics.density

        var currentTextBlocks = JSONArray()

        fun flushTextBlocks() {
            if (currentTextBlocks.length() > 0) {
                val spannable = SpannableHtmlEngine.buildSpannableFromBlocks(context, currentTextBlocks, onLinkPress)
                if (spannable.isNotEmpty()) {
                    val tv = TextView(context).apply {
                        text = spannable
                        setTextIsSelectable(selectable ?: true)
                        movementMethod = LinkMovementMethod.getInstance()
                        setBackgroundColor(Color.TRANSPARENT)
                        ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
                            override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfoCompat) {
                                super.onInitializeAccessibilityNodeInfo(host, info)
                                info.className = TextView::class.java.name
                            }
                        })
                    }
                    containerLayout.addView(tv)
                }
                currentTextBlocks = JSONArray()
            }
        }

        for (i in 0 until blocks.length()) {
            val blockObj = blocks.optJSONObject(i) ?: continue
            val blockType = blockObj.optString("type")

            if (blockType == "Table") {
                val rows = blockObj.optJSONArray("rows")
                if (rows != null && rows.length() > 0) {
                    flushTextBlocks()

                    val borderColorHex = blockObj.optString("borderLeftColor")
                    val borderColorInt = try { Color.parseColor(borderColorHex) } catch (_: Exception) { Color.TRANSPARENT }
                    val borderWidthDp = blockObj.optDouble("borderLeftWidth").toFloat()
                    val borderWidthPx = (borderWidthDp * density).toInt().coerceAtLeast(1)
                    val mt = (blockObj.optDouble("marginTop") * density).toInt()
                    val mb = (blockObj.optDouble("marginBottom") * density).toInt()
                    val padH = (blockObj.optDouble("paddingLeft") * density).toInt()
                    val padV = (blockObj.optDouble("paddingTop") * density).toInt()

                    val hScrollView = HorizontalScrollView(context).apply {
                        isHorizontalScrollBarEnabled = true
                        isFillViewport = false
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {
                            setMargins(0, mt, 0, mb)
                        }
                    }

                    val tableLayout = TableLayout(context).apply {
                        background = GradientDrawable().apply {
                            setStroke(borderWidthPx, borderColorInt)
                            setColor(Color.TRANSPARENT)
                        }
                        showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
                        dividerDrawable = ColorDrawable(borderColorInt)
                    }

                    for (r in 0 until rows.length()) {
                        val rowObj = rows.optJSONObject(r) ?: continue
                        val cells = rowObj.optJSONArray("cells") ?: continue
                        val tableRow = TableRow(context).apply {
                            showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
                            dividerDrawable = ColorDrawable(borderColorInt)
                        }

                        for (c in 0 until cells.length()) {
                            val cellObj = cells.optJSONObject(c) ?: continue
                            val cellSpannable = SpannableHtmlEngine.buildCellSpannable(cellObj, onLinkPress)
                            val cellTv = TextView(context).apply {
                                text = cellSpannable
                                setPadding(padH, padV, padH, padV)
                                setTextIsSelectable(selectable ?: true)
                                movementMethod = LinkMovementMethod.getInstance()
                            }
                            tableRow.addView(cellTv)
                        }
                        tableLayout.addView(tableRow)
                    }

                    hScrollView.addView(tableLayout)
                    containerLayout.addView(hScrollView)
                    continue
                }
            }

            if (blockType == "Image" || blockType == "Figure") {
                val url = blockObj.optString("url")
                if (url.isNotEmpty()) {
                    flushTextBlocks()

                    val mt = (blockObj.optDouble("marginTop") * density).toInt()
                    val mb = (blockObj.optDouble("marginBottom") * density).toInt()
                    val bgHex = blockObj.optString("backgroundColor")
                    val bgInt = try { Color.parseColor(bgHex) } catch (_: Exception) { Color.TRANSPARENT }

                    val imgContainer = LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {
                            setMargins(0, mt, 0, mb)
                        }
                    }

                    val aspect = blockObj.optDouble("aspectRatio").let { if (it > 0) it else 0.3333 }
                    val imageView = object : android.widget.ImageView(context) {
                        var aspectVal = aspect
                        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                            val w = MeasureSpec.getSize(widthMeasureSpec)
                            if (w > 0) {
                                val d = drawable
                                val ratio = if (d != null && d.intrinsicWidth > 0 && d.intrinsicHeight > 0) {
                                    d.intrinsicHeight.toDouble() / d.intrinsicWidth.toDouble()
                                } else {
                                    aspectVal
                                }
                                val h = (w * ratio).toInt().coerceAtLeast((50 * density).toInt())
                                setMeasuredDimension(w, h)
                            } else {
                                super.onMeasure(widthMeasureSpec, heightMeasureSpec)
                            }
                        }
                    }.apply {
                        scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                        outlineProvider = object : android.view.ViewOutlineProvider() {
                            override fun getOutline(view: View, outline: android.graphics.Outline) {
                                if (view.width > 0 && view.height > 0) {
                                    outline.setRoundRect(0, 0, view.width, view.height, 8 * density)
                                }
                            }
                        }
                        clipToOutline = true
                        background = GradientDrawable().apply {
                            cornerRadius = 8 * density
                            setColor(if (bgHex.isNotEmpty()) bgInt else Color.parseColor("#F1F5F9"))
                        }
                    }

                    val cached = imageCache.get(url)
                    if (cached != null) {
                        imageView.setImageBitmap(cached)
                        imageView.invalidateOutline()
                    } else {
                        Thread {
                            try {
                                var currentUrl = url
                                var bitmap: android.graphics.Bitmap? = null
                                for (redirect in 0..6) {
                                    val u = java.net.URL(currentUrl)
                                    val conn = u.openConnection() as java.net.HttpURLConnection
                                    conn.connectTimeout = 10000
                                    conn.readTimeout = 10000
                                    conn.instanceFollowRedirects = true
                                    val userAgent = System.getProperty("http.agent")
                                        ?: "FastHtmlParser (Android ${android.os.Build.VERSION.RELEASE}; ${android.os.Build.MODEL})"
                                    conn.setRequestProperty("User-Agent", userAgent)
                                    conn.setRequestProperty("Accept", "image/*,*/*")
                                    conn.connect()
                                    val code = conn.responseCode
                                    if (code in 301..308) {
                                        val loc = conn.getHeaderField("Location")
                                        conn.disconnect()
                                        if (!loc.isNullOrEmpty()) {
                                            currentUrl = loc
                                            continue
                                        }
                                    }
                                    if (code in 200..299) {
                                        val input = java.io.BufferedInputStream(conn.inputStream)
                                        val bytes = input.readBytes()
                                        input.close()
                                        conn.disconnect()
                                        bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                        if (bitmap != null) {
                                            imageCache.put(url, bitmap)
                                        }
                                        break
                                    }
                                    conn.disconnect()
                                    break
                                }
                                if (bitmap != null) {
                                    val finalBmp = bitmap
                                    imageView.post {
                                        imageView.setImageBitmap(finalBmp)
                                        imageView.invalidateOutline()
                                        reportContentHeight()
                                    }
                                }
                            } catch (_: Exception) {
                            }
                        }.start()
                    }

                    imgContainer.addView(imageView)

                    val caption = blockObj.optString("caption")
                    if (caption.isNotEmpty()) {
                        val captionColorHex = blockObj.optString("color")
                        val captionColorInt = try { Color.parseColor(captionColorHex) } catch (_: Exception) { Color.TRANSPARENT }
                        val captionFontSize = blockObj.optDouble("fontSize").toFloat()
                        val captionPadTop = (blockObj.optDouble("paddingTop") * density).toInt()

                        val captionTv = TextView(context).apply {
                            text = caption
                            setTypeface(typeface, android.graphics.Typeface.ITALIC)
                            setTextColor(captionColorInt)
                            if (captionFontSize > 0f) textSize = captionFontSize
                            setPadding(0, captionPadTop, 0, 0)
                        }
                        imgContainer.addView(captionTv)
                    }

                    containerLayout.addView(imgContainer)
                    continue
                }
            }

            if (blockType == "Separator") {
                flushTextBlocks()
                val hrColorHex = blockObj.optString("color")
                val hrColorInt = try { Color.parseColor(hrColorHex) } catch (_: Exception) { Color.TRANSPARENT }
                val mt = (blockObj.optDouble("marginTop") * density).toInt()
                val mb = (blockObj.optDouble("marginBottom") * density).toInt()
                val hrHeightDp = blockObj.optDouble("lineHeight")
                val hrHeightPx = (hrHeightDp * density).toInt().coerceAtLeast(1)

                val divider = View(context).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        hrHeightPx
                    ).apply {
                        setMargins(0, mt, 0, mb)
                    }
                    setBackgroundColor(hrColorInt)
                }
                containerLayout.addView(divider)
                continue
            }

            currentTextBlocks.put(blockObj)
        }

        flushTextBlocks()

        // Measure unconstrained layout height and report back to React Native Yoga
        containerLayout.post {
            reportContentHeight()
        }
    }

    private fun reportContentHeight() {
        val density = context.resources.displayMetrics.density
        val w = if (containerLayout.width > 0) containerLayout.width else context.resources.displayMetrics.widthPixels
        val widthSpec = android.view.View.MeasureSpec.makeMeasureSpec(w, android.view.View.MeasureSpec.EXACTLY)
        val heightSpec = android.view.View.MeasureSpec.makeMeasureSpec(0, android.view.View.MeasureSpec.UNSPECIFIED)
        containerLayout.measure(widthSpec, heightSpec)
        val hPx = containerLayout.measuredHeight
        if (hPx > 0 && density > 0) {
            val hDp = hPx.toDouble() / density.toDouble()
            onContentSizeChange?.invoke(hDp)
        }
    }

    companion object {
        val imageCache = android.util.LruCache<String, android.graphics.Bitmap>(30)
    }
}
