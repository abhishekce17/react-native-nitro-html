#include <jni.h>
#include "fasthtmlparserOnLoad.hpp"
#include <fbjni/fbjni.h>
#include "HybridFastHtmlParser.hpp"

extern "C" JNIEXPORT jstring JNICALL
Java_com_margelo_nitro_fasthtmlparser_SpannableHtmlEngine_nativeParseHtmlToJson(
    JNIEnv* env,
    jclass /* clazz */,
    jstring jHtml,
    jstring jBaseStyleJson,
    jstring jTagsStylesJson
) {
    if (!jHtml) return env->NewStringUTF("[]");

    const char* htmlChars = env->GetStringUTFChars(jHtml, nullptr);
    std::string htmlStr = htmlChars ? htmlChars : "";
    if (htmlChars) env->ReleaseStringUTFChars(jHtml, htmlChars);

    std::string baseStyleStr = "";
    if (jBaseStyleJson) {
        const char* baseChars = env->GetStringUTFChars(jBaseStyleJson, nullptr);
        if (baseChars) {
            baseStyleStr = baseChars;
            env->ReleaseStringUTFChars(jBaseStyleJson, baseChars);
        }
    }

    std::string tagsStylesStr = "";
    if (jTagsStylesJson) {
        const char* tagChars = env->GetStringUTFChars(jTagsStylesJson, nullptr);
        if (tagChars) {
            tagsStylesStr = tagChars;
            env->ReleaseStringUTFChars(jTagsStylesJson, tagChars);
        }
    }

    std::string jsonResult = margelo::nitro::fasthtmlparser::HybridFastHtmlParser::parseHtmlToJson(
        htmlStr,
        baseStyleStr,
        tagsStylesStr
    );

    return env->NewStringUTF(jsonResult.c_str());
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::fasthtmlparser::registerAllNatives();
  });
}