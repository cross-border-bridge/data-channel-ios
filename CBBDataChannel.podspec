Pod::Spec.new do |s|
  s.name = "CBBDataChannel"
  s.version = "2.0.5"
  s.summary = "DataChannel for iOS"
  s.homepage = "https://github.com/cross-border-bridge/data-channel-ios"
  s.author = 'DWANGO Co., Ltd.'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.platform = :ios, "8.0"
  s.source = { :git => "https://github.com/cross-border-bridge/data-channel-ios.git", :tag => "#{s.version}" }
  s.source_files = "CBBDataChannel/**/*.{h,m}"
  s.dependency "CBBDataBus", "~> 2.1.3"
  s.preserve_path = "CBBDataChannel.modulemap"
  s.module_map = "CBBDataChannel.modulemap"
end
