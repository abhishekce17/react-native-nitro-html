#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface FastHtmlParserBridge : NSObject

+ (NSAttributedString *)buildAttributedStringFromHtml:(NSString *)html
                                            baseStyle:(nullable NSDictionary<NSString *, id> *)baseStyle
                                           tagsStyles:(nullable NSDictionary<NSString *, NSDictionary<NSString *, id> *> *)tagsStyles;

+ (NSAttributedString *)buildAttributedStringFromHtml:(NSString *)html
                                            baseStyle:(nullable NSDictionary<NSString *, id> *)baseStyle
                                           tagsStyles:(nullable NSDictionary<NSString *, NSDictionary<NSString *, id> *> *)tagsStyles
                                       containerWidth:(CGFloat)containerWidth;

+ (void)setImageAspectRatio:(CGFloat)aspect forUrl:(NSString *)url;
+ (CGFloat)imageAspectRatioForUrl:(NSString *)url;

@end

NS_ASSUME_NONNULL_END
