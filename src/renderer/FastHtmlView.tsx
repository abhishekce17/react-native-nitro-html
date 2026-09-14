import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  PixelRatio,
} from 'react-native';
import { getHostComponent, callback } from 'react-native-nitro-modules';
import {
  parseHTML,
  parseHTMLAsync,
  calculateHTMLLayout,
  calculateHTMLLayoutAsync,
  storeAst,
} from '../parser';
import { getBlocks } from '../wrappers';
import type {
  NativeHtmlViewProps,
  NativeHtmlViewMethods,
  NativeTextStyle,
} from '../NativeHtmlView.nitro';
import type {
  ParsedArticle,
  HtmlLayoutMeasurement,
} from '../FastHtmlParser.nitro';
import type { FastHtmlViewProps } from './types';

// ─── NativeHtmlView ──────────────────────────────────────────────────────────
// The single Fabric native view that receives an HTML string / astId and renders it
// 100% natively (UITextView + TextKit2 on iOS, TextView + Spannable on Android).

export const NativeHtmlView = getHostComponent<
  NativeHtmlViewProps,
  NativeHtmlViewMethods
>('NativeHtmlView', () => ({
  uiViewClassName: 'NativeHtmlView',
  bubblingEventTypes: {},
  directEventTypes: {},
  validAttributes: {
    astId: true,
    selectable: true,
    onLinkPress: true,
    onContentSizeChange: true,
  },
}));

// ─── Custom Renderer Detection ───────────────────────────────────────────────
// Zero-allocation O(1) check that avoids Object.keys() heap allocations.

const EMPTY_STYLE: NativeTextStyle = Object.freeze({});
const EMPTY_TAGS_STYLES: Record<string, NativeTextStyle> = Object.freeze({});

function hasCustomRenderers(renderers?: Record<string, unknown>): boolean {
  if (!renderers) return false;
  for (const key in renderers) {
    if (renderers[key] !== undefined) return true;
  }
  return false;
}

const NativeHtmlSegmentView = React.memo(function NativeHtmlSegmentViewImpl({
  html,
  baseStyle,
  tagsStyles,
  selectable,
  onLinkPress,
  windowWidth,
  fontScale,
}: {
  html: string;
  baseStyle?: NativeTextStyle;
  tagsStyles?: Record<string, NativeTextStyle>;
  selectable?: boolean;
  onLinkPress?: (url: string) => void;
  windowWidth: number;
  fontScale: number;
}) {
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const measurement = React.useMemo(
    () =>
      calculateHTMLLayout(html, windowWidth, baseStyle, tagsStyles, fontScale),
    [html, windowWidth, baseStyle, tagsStyles, fontScale]
  );
  const height = measuredHeight > 0 ? measuredHeight : measurement.height;
  const handleContentSizeChange = React.useCallback((newH: number) => {
    setMeasuredHeight((prev) => (Math.abs(prev - newH) > 1 ? newH : prev));
  }, []);
  const wrappedOnContentSizeChange = React.useMemo(
    () => callback(handleContentSizeChange),
    [handleContentSizeChange]
  );
  const wrappedOnLinkPress = React.useMemo(
    () => (onLinkPress ? callback(onLinkPress) : undefined),
    [onLinkPress]
  );

  return (
    <NativeHtmlView
      astId={measurement.astId}
      selectable={selectable}
      onLinkPress={wrappedOnLinkPress}
      onContentSizeChange={wrappedOnContentSizeChange}
      style={[styles.textSegment, height > 0 ? { height } : undefined]}
    />
  );
});

// ─── FastHtmlView ─────────────────────────────────────────────────────────────
//
// Architecture:
//
//  ┌─ Fast Path (default, no renderers prop) ──────────────────────────────┐
//  │  1. JSI synchronous or C++ worker async calculateHTMLLayout() buffers.│
//  │  2. Passes lightweight astId token to NativeHtmlView.                 │
//  │  100% Native Fabric Layer. Zero layout shift. Zero clipping.          │
//  └───────────────────────────────────────────────────────────────────────┘
//
//  ┌─ Custom Renderer Path (when renderers prop is provided) ──────────────┐
//  │  Walk C++ AST blocks via getBlocks().                                  │
//  │  · Custom Block (Video, Code, Poll) ──► React Component + tagStyle    │
//  │  · Text Segment ──► NativeHtmlSegmentView + dynamic native sync       │
//  └───────────────────────────────────────────────────────────────────────┘

export function FastHtmlView({
  html,
  mode = 'sync',
  parsedAst,
  baseStyle,
  tagsStyles,
  renderers,
  selectable = true,
  fontFeatureSettings,
  onLinkPress,
  style,
}: FastHtmlViewProps): React.ReactElement | null {
  const { width: windowWidth } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();

  const nativeBaseStyle: NativeTextStyle = React.useMemo(() => {
    if (fontFeatureSettings) {
      return { ...((baseStyle as NativeTextStyle) ?? {}), fontFeatureSettings };
    }
    return (baseStyle as NativeTextStyle) ?? EMPTY_STYLE;
  }, [baseStyle, fontFeatureSettings]);

  const nativeTagsStyles: Record<string, NativeTextStyle> =
    React.useMemo(() => {
      return (
        (tagsStyles as Record<string, NativeTextStyle>) ?? EMPTY_TAGS_STYLES
      );
    }, [tagsStyles]);

  const wrappedOnLinkPress = React.useMemo(
    () => (onLinkPress ? callback(onLinkPress) : undefined),
    [onLinkPress]
  );

  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [asyncMeasurement, setAsyncMeasurement] =
    useState<HtmlLayoutMeasurement>({ height: 0, astId: '' });
  const [asyncArticle, setAsyncArticle] = useState<ParsedArticle | null>(null);

  useEffect(() => {
    if (mode !== 'async' || !html || parsedAst) return;
    let isMounted = true;
    calculateHTMLLayoutAsync(
      html,
      windowWidth,
      nativeBaseStyle,
      nativeTagsStyles,
      fontScale
    )
      .then((m) => {
        if (isMounted) {
          setAsyncMeasurement(m);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [
    mode,
    html,
    parsedAst,
    windowWidth,
    nativeBaseStyle,
    nativeTagsStyles,
    fontScale,
  ]);

  useEffect(() => {
    if (
      mode !== 'async' ||
      !html ||
      parsedAst ||
      !hasCustomRenderers(renderers)
    ) {
      return;
    }
    let isMounted = true;
    parseHTMLAsync(html)
      .then((art) => {
        if (isMounted) setAsyncArticle(art);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [mode, html, parsedAst, renderers]);

  const syncMeasurement = React.useMemo(() => {
    if (mode !== 'sync') return null;
    if (parsedAst) {
      return { height: 0, astId: storeAst(parsedAst) };
    }
    if (html) {
      return calculateHTMLLayout(
        html,
        windowWidth,
        nativeBaseStyle,
        nativeTagsStyles,
        fontScale
      );
    }
    return { height: 0, astId: '' };
  }, [
    mode,
    html,
    parsedAst,
    windowWidth,
    nativeBaseStyle,
    nativeTagsStyles,
    fontScale,
  ]);

  const measurement =
    mode === 'async'
      ? asyncMeasurement
      : (syncMeasurement ?? { height: 0, astId: '' });

  const height = measuredHeight > 0 ? measuredHeight : measurement.height;
  const astId = measurement.astId || undefined;

  const handleContentSizeChange = React.useCallback((newH: number) => {
    setMeasuredHeight((prev) => (Math.abs(prev - newH) > 1 ? newH : prev));
  }, []);

  const wrappedOnContentSizeChange = React.useMemo(
    () => callback(handleContentSizeChange),
    [handleContentSizeChange]
  );

  // ── Fast Path (100% Native Fabric Layer with C++ JSI / Worker Height) ───────
  if (!hasCustomRenderers(renderers)) {
    if (!astId) {
      return <View style={[styles.container, style]} />;
    }
    return (
      <NativeHtmlView
        astId={astId}
        selectable={selectable}
        onLinkPress={wrappedOnLinkPress}
        onContentSizeChange={wrappedOnContentSizeChange}
        style={[styles.container, height > 0 ? { height } : undefined, style]}
      />
    );
  }

  // ── Custom Renderer Path (Direct C++ Lexbor Call + Segment Sizing) ──────────
  const article =
    parsedAst ||
    (mode === 'async' ? asyncArticle : html ? parseHTML(html) : null);

  if (!article || !renderers) {
    return <View style={[styles.container, style]} />;
  }

  const blocks = getBlocks(article);
  const segments: React.ReactNode[] = [];
  let pendingHtml = '';
  let key = 0;

  const flush = () => {
    if (pendingHtml.trim().length > 0) {
      segments.push(
        <NativeHtmlSegmentView
          key={`n-${key++}`}
          html={pendingHtml}
          baseStyle={nativeBaseStyle}
          tagsStyles={nativeTagsStyles}
          selectable={selectable}
          onLinkPress={onLinkPress}
          windowWidth={windowWidth}
          fontScale={fontScale}
        />
      );
      pendingHtml = '';
    }
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const Renderer =
      renderers[block.type] || renderers[block.type.toLowerCase()];
    if (Renderer) {
      flush();
      const tagStyle =
        tagsStyles?.[block.type] || tagsStyles?.[block.type.toLowerCase()];
      segments.push(
        <Renderer
          key={`c-${i}`}
          block={block}
          baseStyle={baseStyle}
          tagStyle={tagStyle}
        />
      );
    } else {
      pendingHtml += block.html;
    }
  }

  flush();

  return <View style={[styles.container, style]}>{segments}</View>;
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  textSegment: { width: '100%' },
});
