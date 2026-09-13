import React from 'react';
import { View, StyleSheet, useWindowDimensions, PixelRatio } from 'react-native';
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
    themeMode: true,
  },
}));

// ─── Custom Renderer Detection ───────────────────────────────────────────────
// Zero-allocation O(1) check that avoids Object.keys() heap allocations.

function hasCustomRenderers(renderers?: Record<string, unknown>): boolean {
  if (!renderers) return false;
  for (const key in renderers) {
    if (renderers[key] !== undefined) return true;
  }
  return false;
}

// ─── FastHtmlView ─────────────────────────────────────────────────────────────
//
// Architecture:
//
//  ┌─ Fast Path (default, no renderers prop) ──────────────────────────────┐
//  │  1. JSI synchronous C++ calculateHTMLHeight() (0.05 ms, zero state)   │
//  │  2. Direct style.height passed into Fabric Yoga                       │
//  │  100% Native Fabric Layer. Zero re-renders. Zero bridge latency.      │
//  └───────────────────────────────────────────────────────────────────────┘
//
//  ┌─ Custom Renderer Path (when renderers prop is provided) ──────────────┐
//  │  Walk C++ AST blocks via getBlocks().                                  │
//  │  · Custom Block (Video, Code, Poll) ──► React Component + tagStyle    │
//  │  · Text Segment ──► NativeHtmlView + synchronous C++ JSI height       │
//  └───────────────────────────────────────────────────────────────────────┘

export function FastHtmlView({
  html,
  parsedAst,
  baseStyle,
  tagsStyles,
  renderers,
  selectable = true,
  themeMode,
  fontFeatureSettings,
  onLinkPress,
  style,
}: FastHtmlViewProps): React.ReactElement | null {
  const { width: windowWidth } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();

  const baseFontSize = (baseStyle?.fontSize as number) ?? 0;
  const baseLineHeight = (baseStyle?.lineHeight as number) ?? 0;

  const nativeBaseStyle = fontFeatureSettings
    ? { ...(baseStyle as NativeTextStyle), fontFeatureSettings }
    : (baseStyle as NativeTextStyle);
  const nativeTagsStyles = tagsStyles as
    Record<string, NativeTextStyle> | undefined;
  const wrappedOnLinkPress = onLinkPress ? callback(onLinkPress) : undefined;

  // ── Fast Path (100% Native Fabric Layer with Synchronous C++ JSI Height) ───
  if (!hasCustomRenderers(renderers)) {
    const height = html
      ? calculateHTMLHeight(
          html,
          windowWidth,
          baseFontSize,
          baseLineHeight,
          fontScale
        )
      : 0;

    return (
      <NativeHtmlView
        html={html || ''}
        baseStyle={nativeBaseStyle}
        tagsStyles={nativeTagsStyles}
        selectable={selectable}
        themeMode={themeMode}
        onLinkPress={wrappedOnLinkPress}
        style={[styles.container, height > 0 ? { height } : undefined, style]}
      />
    );
  }

  // ── Custom Renderer Path (Direct C++ Lexbor Call + Segment JSI Sizing) ──────
  const article = parsedAst || (html ? parseHTML(html) : null);
  if (!article || !renderers) return null;

  const blocks = getBlocks(article);
  const segments: React.ReactNode[] = [];
  let pendingHtml = '';
  let key = 0;

  const flush = () => {
    if (pendingHtml.trim().length > 0) {
      const segHeight = calculateHTMLHeight(
        pendingHtml,
        windowWidth,
        baseFontSize,
        baseLineHeight,
        fontScale
      );
      segments.push(
        <NativeHtmlView
          key={`n-${key++}`}
          html={pendingHtml}
          baseStyle={nativeBaseStyle}
          tagsStyles={nativeTagsStyles}
          selectable={selectable}
          themeMode={themeMode}
          onLinkPress={wrappedOnLinkPress}
          style={[
            styles.textSegment,
            segHeight > 0 ? { height: segHeight } : undefined,
          ]}
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


