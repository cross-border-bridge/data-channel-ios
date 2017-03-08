// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBDataChannel.h"

NSString* const CBBDataChannelErrorDomain = @"CBBDataChannelErrorDomain";

@interface CBBDataChannel ()
@property (nonatomic, readwrite) CBBDataBus* dataBus;
@property (nonatomic, readwrite) BOOL destroyed;
@property (nonatomic) CBBDataBusHandler dataBusHandler;
@property (nonatomic) NSInteger tagCount;
@property (nonatomic) NSMutableDictionary<NSString*, CBBDataChannelCallback>* waitingCallbacks;
@property (nonatomic) NSMutableArray<CBBDataChannelHandler>* handlers;
@end

enum DataType {
    DataTypePush = 1,
    DataTypeRequest = 2,
    DataTypeResponse = 3,
    DataTypeError = 4
};

@implementation CBBDataChannel

- (instancetype)initWithDataBus:(CBBDataBus*)dataBus
{
    if (self = [super init]) {
        _dataBus = dataBus;
        _tagCount = 0;
        _waitingCallbacks = [NSMutableDictionary dictionary];
        _handlers = [NSMutableArray array];
    }
    return self;
}

- (void)dealloc
{
    [self destroy];
}

- (void)destroy
{
    if (_destroyed) {
        return;
    }
    for (CBBDataChannelCallback callback in _waitingCallbacks.objectEnumerator) {
        NSError* error = [NSError errorWithDomain:CBBDataChannelErrorDomain
                                             code:CBBDataChannelErrorTypeClosed
                                         userInfo:nil];
        callback(error, nil);
    }
    [self removeAllHandlers];
    _destroyed = YES;
}

- (void)sendPush:(id)data
{
    if (_destroyed) {
        return;
    }
    [_dataBus sendData:@[ @(DataTypePush), @[ data ] ]];
}

- (void)sendRequest:(id)data
           callback:(CBBDataChannelCallback)callback
{
    if (_destroyed) {
        return;
    }
    [self sendRequest:data timeout:0.0 callback:callback];
}

- (void)sendRequest:(id)data
            timeout:(NSTimeInterval)timeout
           callback:(CBBDataChannelCallback)callback
{
    if (_destroyed) {
        return;
    }
    [self registerHandler];
    NSString* tag = [self acquireTag];
    if (0.0 < timeout) {
        __weak typeof(self) self_ = self;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeout * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            if (self_) {
                CBBDataChannelCallback callback = self_.waitingCallbacks[tag];
                if (callback) {
                    NSError* error = [NSError errorWithDomain:CBBDataChannelErrorDomain
                                                         code:CBBDataChannelErrorTypeTimeout
                                                     userInfo:nil];
                    callback(error, nil);
                }
            }
        });
    }
    _waitingCallbacks[tag] = callback;
    [_dataBus sendData:@[ @(DataTypeRequest), @[ tag, data ] ]];
}

- (void)addHandler:(CBBDataChannelHandler)handler
{
    if (_destroyed) {
        return;
    }
    @synchronized(self)
    {
        if ([_handlers containsObject:handler]) {
            return;
        }
        if (_handlers.count == 0) {
            [self registerHandler];
        }
        [_handlers addObject:handler];
    }
}

- (void)removeHandler:(CBBDataChannelHandler)handler
{
    if (_destroyed) {
        return;
    }
    @synchronized(self)
    {
        [_handlers removeObject:handler];
        if (_handlers.count == 0) {
            [self unregisterHandler];
        }
    }
}

- (void)removeAllHandlers
{
    if (_destroyed) {
        return;
    }
    @synchronized(self)
    {
        if (_handlers.count == 0) {
            return;
        }

        [_handlers removeAllObjects];
        [self unregisterHandler];
    }
}

- (void)registerHandler
{
    if (_dataBusHandler) {
        return;
    }
    __weak typeof(self) self_ = self;
    _dataBusHandler = ^(NSArray* message) {
        if (message.count != 2) {
            return;
        }
        int dataType = [message[0] intValue];
        NSArray* data = message[1];
        switch (dataType) {
            case DataTypePush: { // data: [packet]
                for (CBBDataChannelHandler handler in self_.handlers.objectEnumerator) {
                    handler(data[0], nil);
                }
                break;
            }
            case DataTypeRequest: { // data: [tag, packet]
                CBBDataChannelResponseCallback responseCallback = ^(id packet) {
                    [self_.dataBus sendData:@[ @(DataTypeResponse), @[ data[0], packet ?: [NSNull null] ] ]];
                };
                for (CBBDataChannelHandler handler in self_.handlers.objectEnumerator) {
                    handler(data[1], responseCallback);
                }
                break;
            }
            case DataTypeResponse: { // data: [tag, packet]
                CBBDataChannelCallback waitingCallback = self_.waitingCallbacks[data[0]];
                if (waitingCallback) {
                    [self_.waitingCallbacks removeObjectForKey:data[0]];
                    waitingCallback(nil, data[1]);
                    return;
                }
                break;
            }
            case DataTypeError: { // data: [tag, errorType]
                NSError* error = [NSError errorWithDomain:CBBDataChannelErrorDomain
                                                     code:[self_ errorTypeFromString:data[1]]
                                                 userInfo:nil];
                CBBDataChannelCallback waitingCallback = self_.waitingCallbacks[data[0]];
                if (waitingCallback) {
                    [self_.waitingCallbacks removeObjectForKey:data[0]];
                    waitingCallback(error, nil);
                    return;
                }
                break;
            }
        }
    };
    [_dataBus addHandler:_dataBusHandler];
}

- (void)unregisterHandler
{
    if (_dataBusHandler) {
        [_dataBus removeHandler:_dataBusHandler];
        _dataBusHandler = nil;
    }
}

- (CBBDataChannelErrorType)errorTypeFromString:(NSString*)errorString
{
    if ([errorString isEqualToString:@"Timeout"]) {
        return CBBDataChannelErrorTypeTimeout;
    } else if ([errorString isEqualToString:@"Closed"]) {
        return CBBDataChannelErrorTypeClosed;
    } else {
        return CBBDataChannelErrorTypeUnspecified;
    }
}

- (NSString*)stringFromErrorType:(CBBDataChannelErrorType)errorType
{
    switch (errorType) {
        case CBBDataChannelErrorTypeUnspecified:
            return @"Unspecified";
        case CBBDataChannelErrorTypeTimeout:
            return @"Timeout";
        case CBBDataChannelErrorTypeClosed:
            return @"Closed";
    }
}

- (NSString*)acquireTag
{
    return [NSString stringWithFormat:@"%@:%ld", @"i", (long)++self.tagCount];
}

@end
