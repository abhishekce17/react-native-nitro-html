import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  PixelRatio,
} from 'react-native';
import { getHostComponent, callback } from 'react-native-nitro-modules';
import { parseHTML, calculateHTMLHeight } from '../parser';
import { getBlocks } from '../wrappers';
import type {
  NativeHtmlViewProps,
  NativeHtmlViewMethods,
  NativeTextStyle,
} from '../NativeHtmlView.nitro';
import type { FastHtmlViewProps } from './types';

// ─── NativeHtmlView ──────────────────────────────────────────────────────────
// The single Fabric native view that receives an HTML string and renders it
// 100% natively (UITextView + TextKit2 on iOS, TextView + Spannable on Android).

export const NativeHtmlView = getHostComponent<
  NativeHtmlViewProps,
  NativeHtmlViewMethods
>('NativeHtmlView', () => ({
  uiViewClassName: 'NativeHtmlView',
  bubblingEventTypes: {},
  directEventTypes: {},
  validAttributes: {
    html: true,
    baseStyle: true,
    tagsStyles: true,
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
  baseFontSize,
  baseLineHeight,
  fontScale,
}: {
  html: string;
  baseStyle?: NativeTextStyle;
  tagsStyles?: Record<string, NativeTextStyle>;
  selectable?: boolean;
  onLinkPress?: (url: string) => void;
  windowWidth: number;
  baseFontSize: number;
  baseLineHeight: number;
  fontScale: number;
}) {
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const initialHeight = React.useMemo(
    () =>
      calculateHTMLHeight(
        html,
        windowWidth,
        baseFontSize,
        baseLineHeight,
        fontScale
      ),
    [html, windowWidth, baseFontSize, baseLineHeight, fontScale]
  );
  const height = measuredHeight > 0 ? measuredHeight : initialHeight;
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
      html={html}
      baseStyle={baseStyle ?? EMPTY_STYLE}
      tagsStyles={tagsStyles ?? EMPTY_TAGS_STYLES}
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
//  │  1. JSI synchronous C++ calculateHTMLHeight() for Frame 0 layout.    │
//  │  2. Dynamic onContentSizeChange syncs 100% exact native measurement.  │
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

  const baseFontSize = (baseStyle?.fontSize as number) ?? 0;
  const baseLineHeight = (baseStyle?.lineHeight as number) ?? 0;

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

  const initialHeight = React.useMemo(
    () =>
      html
        ? calculateHTMLHeight(
            html,
            windowWidth,
            baseFontSize,
            baseLineHeight,
            fontScale
          )
        : 0,
    [html, windowWidth, baseFontSize, baseLineHeight, fontScale]
  );

  const height = measuredHeight > 0 ? measuredHeight : initialHeight;

  const handleContentSizeChange = React.useCallback((newH: number) => {
    setMeasuredHeight((prev) => (Math.abs(prev - newH) > 1 ? newH : prev));
  }, []);

  const wrappedOnContentSizeChange = React.useMemo(
    () => callback(handleContentSizeChange),
    [handleContentSizeChange]
  );

  // ── Fast Path (100% Native Fabric Layer with Synchronous C++ JSI Height) ───
  if (!hasCustomRenderers(renderers)) {
    return (
      <NativeHtmlView
        html={html || ''}
        baseStyle={nativeBaseStyle}
        tagsStyles={nativeTagsStyles}
        selectable={selectable}
        onLinkPress={wrappedOnLinkPress}
        onContentSizeChange={wrappedOnContentSizeChange}
        style={[styles.container, height > 0 ? { height } : undefined, style]}
      />
    );
  }

  // ── Custom Renderer Path (Direct C++ Lexbor Call + Segment Sizing) ──────────
  const article = parsedAst || (html ? parseHTML(html) : null);
  if (!article || !renderers) return null;

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
          baseFontSize={baseFontSize}
          baseLineHeight={baseLineHeight}
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
