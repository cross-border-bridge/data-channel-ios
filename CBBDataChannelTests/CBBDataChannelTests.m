// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBDataChannel.h"
#import "CBBMemoryQueueDataBus.h"
#import <XCTest/XCTest.h>

@interface CBBDataChannelTests : XCTestCase
@property (atomic) CBBDataChannel* dataChA;
@property (atomic) CBBDataChannel* dataChB;
@property (atomic) NSInteger counter;
@end

@implementation CBBDataChannelTests

- (void)setUp
{
    [super setUp];
    CBBMemoryQueue* mqA = [[CBBMemoryQueue alloc] init];
    CBBMemoryQueue* mqB = [[CBBMemoryQueue alloc] init];
    CBBDataBus* dataBusA = [[CBBMemoryQueueDataBus alloc] initWithSender:mqA receiver:mqB];
    CBBDataBus* dataBusB = [[CBBMemoryQueueDataBus alloc] initWithSender:mqB receiver:mqA];
    _dataChA = [[CBBDataChannel alloc] initWithDataBus:dataBusA];
    _dataChB = [[CBBDataChannel alloc] initWithDataBus:dataBusB];
}

- (void)tearDown
{
    [super tearDown];
}

- (void)testSendPush
{
    __weak CBBDataChannelTests* self_ = self;

    // DataChannelBにPUSHを受信することを期待するハンドラを設置
    [_dataChB addHandler:^(id _Nullable packetObject, CBBDataChannelResponseCallback _Nullable callback) {
        NSArray* packet = packetObject;
        NSLog(@"packet=%@", packet);
        XCTAssertEqual(packet.count, 2);
        XCTAssertEqual(packet[0], @"PACKET");
        XCTAssertEqual(packet[1], @(1));
        XCTAssertNil(callback);
        self_.counter++;
    }];

    // DataChannelAからPUSHを送信
    _counter = 0;
    [_dataChA sendPush:@[ @"PACKET", @(1) ]];
    XCTAssertEqual(_counter, 1);

    // ハンドラを解除
    [_dataChB removeAllHandlers];

    // 反応しないことを確認
    [_dataChA sendPush:@[ @"PACKET", @(2) ]];
    XCTAssertEqual(_counter, 1);
}

- (void)testSendRequest
{
    __weak CBBDataChannelTests* self_ = self;
    // DataChannelBにREQUESTを受信することを期待するハンドラを設置
    [_dataChB addHandler:^(id _Nullable packetObject, CBBDataChannelResponseCallback _Nullable callback) {
        NSArray* packet = packetObject;
        NSLog(@"packet=%@", packet);
        XCTAssertEqual(packet.count, 2);
        XCTAssertEqual(packet[0], @"PACKET");
        XCTAssertEqual(packet[1], @(1));
        XCTAssertNotNil(callback);
        callback(@[ @"OK" ]);
        self_.counter++;
    }];

    // DataChannelAからREQUESTを送信
    _counter = 0;
    [_dataChA sendRequest:@[ @"PACKET", @(1) ]
                  timeout:100
                 callback:^(NSError* _Nullable errorType, id _Nullable packetObject) {
                     NSArray* packet = packetObject;
                     NSLog(@"errorType=%@, packet=%@", errorType, packet);
                     XCTAssertNil(errorType);
                     XCTAssertEqual(packet.count, 1);
                     XCTAssertEqual(packet[0], @"OK");
                     self_.counter++;
                 }];
    XCTAssertEqual(_counter, 2);

    // ハンドラを解除
    [_dataChB removeAllHandlers];

    // 反応しないことを確認
    [_dataChA sendPush:@[ @"PACKET", @(2) ]];
    XCTAssertEqual(_counter, 2);
}

@end
