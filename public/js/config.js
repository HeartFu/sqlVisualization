var visoConfig = {
    visoTemplate: {}
}

// 基本连接线样式
visoConfig.connectorPaintStyle = {
    lineWidth: 2,
    strokeStyle: '#c4c4c4',
    outlineColor: '',
    outlineWidth: ''
}


visoConfig.baseStyle = {
    endpoint: ['Dot', {
        radius: 2,
        outlineStroke:'red',
        outlineWidth:2
    }], // 端点的形状
    connectorStyle: visoConfig.connectorPaintStyle, // 连接线的颜色，大小样式
    connectorHoverStyle: visoConfig.connectorHoverStyle,
    paintStyle: {
        lineWidth: 2
    }, // 端点的颜色样式
    hoverPaintStyle: {stroke: 'blue'},
    isSource: true, // 是否可以拖动（作为连线起点）
    isTarget: true, // 是否可以放置（连线终点）
    connectorOverlays: [
        ['Arrow', {
            width: 10,
            length: 13,
            location: 1
        }],
    ]
}
visoConfig.baseArchors = ['RightMiddle', 'LeftMiddle']
