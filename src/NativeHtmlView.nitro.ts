import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules';

export interface NativeTextStyle {
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  letterSpacing?: number;
  textAlign?: string;
  textTransform?: string;
  textIndent?: number;
  textDecorationLine?: string;
  textDecorationColor?: string;
  textDecorationStyle?: string;
  backgroundColor?: string;
  opacity?: number;
  margin?: number;
  marginVertical?: number;
  marginHorizontal?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  padding?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  borderLeftColor?: string;
  borderLeftWidth?: number;
  fontFeatureSettings?: string;
}

export interface NativeHtmlViewProps extends HybridViewProps {
  html?: string;
  baseStyle?: NativeTextStyle;
  tagsStyles?: Record<string, NativeTextStyle>;
  selectable?: boolean;
  onLinkPress?: (url: string) => void;
  onContentSizeChange?: (height: number) => void;
}

export interface NativeHtmlViewMethods extends HybridViewMethods {
  getTextContent(): string;
}

export type NativeHtmlView = HybridView<
  NativeHtmlViewProps,
  NativeHtmlViewMethods,
  { ios: 'swift'; android: 'kotlin' }
>;
