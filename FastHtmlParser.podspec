require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "FastHtmlParser"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/abhishekce17/react-native-fast-html-parser.git", :tag => "#{s.version}" }

  # ── Lexbor: download at pod install time (keeps npm package small) ───────────
  # Clones Lexbor source into cpp/lexbor/ during `pod install`.
  # Subsequent installs skip the clone if the directory already exists.
  s.prepare_command = <<-CMD
    LEXBOR_VERSION="v2.3.0"
    LEXBOR_DIR="cpp/lexbor"
    if [ ! -d "$LEXBOR_DIR" ]; then
      echo "[FastHtmlParser] Downloading Lexbor $LEXBOR_VERSION HTML parser..."
      git clone --depth 1 --branch "$LEXBOR_VERSION" \
        https://github.com/lexbor/lexbor.git "$LEXBOR_DIR"
      echo "[FastHtmlParser] Lexbor ready."
    else
      echo "[FastHtmlParser] Lexbor already present, skipping download."
    fi
  CMD

  s.source_files = [
    "ios/**/*.{m,mm,swift}",
    "cpp/*.{hpp,h}",
    "cpp/HybridFastHtmlParser.cpp",
    # Lexbor C source files only (headers resolved via HEADER_SEARCH_PATHS)
    "cpp/lexbor/source/**/*.c",
    # Nitrogen generated sources
    "nitrogen/generated/shared/**/*.{h,hpp,c,cpp,swift}",
    "nitrogen/generated/ios/**/*.{h,hpp,c,cpp,mm,swift}",
  ]
  s.exclude_files = [
    "cpp/lexbor/source/lexbor/ports/windows_nt/**/*",
  ]

  s.public_header_files = [
    "ios/**/*.{h,hpp}",
    "cpp/*.hpp",
    "nitrogen/generated/shared/**/*.{h,hpp}",
    "nitrogen/generated/ios/FastHtmlParser-Swift-Cxx-Bridge.hpp",
  ]
  s.private_header_files = [
    "nitrogen/generated/ios/c++/**/*.{h,hpp}",
    "nitrogen/generated/shared/**/views/**/*",
  ]

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency 'NitroModules'

  load 'nitrogen/generated/ios/FastHtmlParser+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)

  # ── xcconfig — use attributes_hash to MERGE, not replace ────────────────────
  s.attributes_hash["pod_target_xcconfig"] ||= {}
  s.attributes_hash["pod_target_xcconfig"]["CLANG_CXX_LANGUAGE_STANDARD"] = "c++20"
  s.attributes_hash["pod_target_xcconfig"]["SWIFT_OBJC_INTEROP_MODE"] = "objcxx"
  s.attributes_hash["pod_target_xcconfig"]["DEFINES_MODULE"] = "YES"
  s.attributes_hash["pod_target_xcconfig"]["SWIFT_INSTALL_OBJC_HEADER"] = "NO"
  # Allow Lexbor's C-style #includes inside the framework module
  s.attributes_hash["pod_target_xcconfig"]["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
  # Add Lexbor header search path
  existing_paths = s.attributes_hash["pod_target_xcconfig"]["HEADER_SEARCH_PATHS"] || ""
  lexbor_path = "$(PODS_TARGET_SRCROOT)/cpp/lexbor/source"
  s.attributes_hash["pod_target_xcconfig"]["HEADER_SEARCH_PATHS"] = "#{existing_paths} #{lexbor_path}".strip

  s.attributes_hash["user_target_xcconfig"] ||= {}
  s.attributes_hash["user_target_xcconfig"]["CLANG_CXX_LANGUAGE_STANDARD"] = "c++20"
end
