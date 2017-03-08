// Copyright © 2017 DWANGO Co., Ltd.

#import <CBBDataBus/CBBDataBus.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

extern NSString* const CBBDataChannelErrorDomain;

typedef NS_ENUM(NSInteger, CBBDataChannelErrorType) {
    CBBDataChannelErrorTypeUnspecified,
    CBBDataChannelErrorTypeTimeout,
    CBBDataChannelErrorTypeClosed
};

typedef void (^CBBDataChannelCallback)(NSError* _Nullable error, id _Nullable packet);
typedef void (^CBBDataChannelResponseCallback)(id _Nullable packet);
typedef void (^CBBDataChannelHandler)(id _Nullable packet, CBBDataChannelResponseCallback _Nullable callback);

@interface CBBDataChannel : NSObject
@property (nonatomic, readonly) NSString* name;
@property (nonatomic, readonly) CBBDataBus* dataBus;
@property (nonatomic, readonly) BOOL destroyed;
- (instancetype)initWithDataBus:(CBBDataBus*)dataBus;
- (void)sendPush:(nullable id)data;
- (void)sendRequest:(nullable id)data
           callback:(CBBDataChannelCallback)callback;
- (void)sendRequest:(nullable id)data
            timeout:(NSTimeInterval)timeout
           callback:(CBBDataChannelCallback)callback;
- (void)addHandler:(CBBDataChannelHandler)handler;
- (void)removeHandler:(CBBDataChannelHandler)handler;
- (void)removeAllHandlers;
- (void)destroy;
@end

NS_ASSUME_NONNULL_END
