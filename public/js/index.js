/* global $, visoConfig, uuid,Mustache, jsPlumb,  */
// jsonData = null;
(function () {
    var area = 'bg'
    var areaId = '#' + area
    var fixedNodeId = {
        begin: 'begin-node',
        end: 'end-node'
    }
    var firstInstance = jsPlumb.getInstance();
    jsPlumb.ready(main)
    jsPlumb.importDefaults({
        ConnectionsDetachable: false
    });

    function processData() {
        var globalSave = [];
        var level = [[]]
        // 先整理源表和去向表的map
        fromSourceMap = new Map()
        json.nodes.forEach(function (item, key) {
            fromSourceMap.set(item.id, {
                'id': item.id,
                'source': [],
                'target': [],
                'type': item.type,
                'colLength': item.columns.length
            })
        });
        json.relations.forEach(function (item, key) {
            if(fromSourceMap.has(item.source.parentName)) {
                fromSourceMap.get(item.source.parentName)['target'].push(item.target.parentName);
            }
            if (fromSourceMap.has(item.target.parentName)) {
                fromSourceMap.get(item.target.parentName)['source'].push(item.source.parentName);
            }
        })
        // 先找出RS表，优先计算RS表的位置
        var top = 50;
        var left = window.innerWidth;
        
        var i = 0;

        // 优先找出没有源也没有target的放到最后一列
        fromSourceMap.forEach(function (item, key) {
            if (item['target'].length == 0 && item['source'].length == 0) {
                // level[i].push({'id': key, 'info':item})
                globalSave.push(key);
                setPosition(top, left, item['id']);
                top += 17 * (item['colLength'] + 1) + 20;
            }
        })

        left -= 430;
        top = 50

        // 找出结束表
        fromSourceMap.forEach(function (item, key) {
            if (item['type'] == 'RS') {
                level[i].push({'id': key, 'info':item})
                globalSave.push(key);
            }
        })

        // 再找出没有Target的表
        fromSourceMap.forEach(function (item, key) {
            if (item['target'].length == 0 && item['type'] != 'RS') {
                level[i].push({'id': key, 'info':item})
                globalSave.push(key);
            }
        })

        while (true) {
            levelData = level[i]
            res = []
            for (var j=0; j < levelData.length; j++) {
                source = levelData[j]['info']['source'];
                source.forEach(function (id) {
                    if (!globalSave.includes(id)) {
                        res.push({'id': id, 'info':fromSourceMap.get(id)});
                        globalSave.push(id);
                    }
                })
            }
            if (res.length != 0) {
                level.push(res);
                i += 1
            } else {
                break;
            }
        }

        // 然后按照每层的顺序重新赋予position中的top/left
        level.forEach(function (item) {
            item.forEach(function (oneData) {
                setPosition(top, left, oneData['id']);
                top += 17 * (oneData['info']['colLength'] + 1) + 20;
            })
            top = 50;
            left = left - 430;
        })
    }

    

    // 设置新的画布中表的位置
    function setPosition(top, left, id) {
        json.nodes.forEach(function (item, key) {
            if (item.id == id) {
                item.top = top;
                item.left = left;
            }
        })
    }

    // 获取基本配置
    function getBaseNodeConfig() {
        return Object.assign({}, visoConfig.baseStyle)
    };

    // 让元素可拖动
    function addDraggable(id) {
        jsPlumb.draggable(id, {
            containment: '#bg'
        });
    };

    // 设置起源表每一列的锚点为了后面连线
    function setOriginPoint(id, position) {
        var config = getBaseNodeConfig()

        config.isSource = true
        //一个起源表的字段可能是多个RS字段的来源 这里-1不限制连线数
        config.maxConnections = -1
        var endpoint = jsPlumb.addEndpoint(id, {
            anchors: [position || 'Right',],
            uuid: id + '-Right'
        }, config)
    };

    // 设置中间表的锚点为了后面连线
    function setMiddlePoint(id, position) {
        var config = getBaseNodeConfig()
        config.maxConnections = -1
        jsPlumb.addEndpoint(id, {
            anchors: ['Left'],
            uuid: id + '-Left'
        }, config)

        jsPlumb.addEndpoint(id, {
            anchors: ['Right'],
            uuid: id + '-Right'
        }, config)
    }

    // 设置RS结果表每一个列的锚点为了后面连线
    function setRSPoint(id, position) {
        var config = getBaseNodeConfig()

        config.isTarget = true
        //RS表一个字段可能是来自多个起源表字段 这里-1不限制连线数
        config.maxConnections = -1;
        jsPlumb.addEndpoint(id, {
            anchors: position || 'Left',
            uuid: id + '-Left'
        }, config);

    };

///////////////////////////////////////////////////
    function main() {
        jsPlumb.setContainer('bg');
        // 先处理数据，重新计算position位置
        processData();
        // 绘图
        DataDraw.draw(json);
        // 初始化放大缩小
        initPanZoom();
    }

///////////////////////////////////////////////
    var DataDraw = {
        // 核心方法
        draw: function (json) {
            var $container = $(areaId)
            var that = this
            //遍历渲染所有节点
            json.nodes.forEach(function (item, key) {
                
                var data = {
                    id: item.id,
                    name: item.name,
                    top: item.top,
                    left: item.left,
                };

                //根据不同类型的表获取各自的模板并填充数据
                var template = that.getTemplate(item);
                $container.append(Mustache.render(template, data));
                //根据json数据添加表的每个列
                //将类数组对象转换为真正数组避免前端报错 XX.forEach is not a function
                item.columns = Array.from(item.columns);
                //将该表的所有列
                item.columns.forEach(col => {
                    var ul = $('#' + item.id + '-cols');
                    //这里li标签的id应该和 addEndpointOfXXX方法里的保持一致 col-group-item
                    var li = $("<li id='id-col' class='panel-node-list' >col_replace</li>");

                    //修改每个列名所在li标签的id使其独一无二
                    li[0].id = item.id + '.' + col.name
                    li[0].title = col.name
                    //填充列名
                    li[0].innerText = col.name;
                    
                    li[0].onclick=function() {
                        var id = item.id;
                        var columnName = col.name
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(columnName);
                            toastr.info('已复制到剪切板');
                        }
                    }

                    li[0].onmouseover=function (){
                        var id = item.id;
                        var columnName = col.name
                        //找到所有需要高亮的列
                        var activeNodes = that.findActiveNode(json.relations, id, columnName);
                        //将所有相关列和线高亮显示
                        activeNodes.forEach(node=>{
                            var targetColumn = node.target.parentName + '.' + node.target.column;
                            var sourceColumn = node.source.parentName + '.' + node.source.column;
                            jsPlumb.selectEndpoints({ source: targetColumn }).each(function (endpoint) {
                                endpoint.connections.forEach(conn=> {
                                    if (conn.sourceId == sourceColumn && conn.targetId == targetColumn) {
                                        conn.addClass('hoverLine');
                                        // conn.getPaintStyle().strokeStyle = 'black';
                                    }
                                })
                                jsPlumb.repaint(targetColumn);
                            });
                            //注意 . 的转义，参考 https://blog.csdn.net/qq_44831907/article/details/120899676
                            $("#"+node.target.parentName+"-cols").find("#"+node.target.parentName+"\\."+node.target.column).css("background-color", "#faebd7");
                            $("#"+node.source.parentName+"-cols").find("#"+node.source.parentName+"\\."+node.source.column).css("background-color", "#faebd7");
                        });
                    }
                    li[0].onmouseout=function() {
                        var id = item.id;
                        var columnName = col.name
                        var activeNodes = that.findActiveNode(json.relations, id, columnName);

                        //将所有相关字段恢复默认显示
                        activeNodes.forEach(node=>{
                            var targetColumn = node.target.parentName + '.' + node.target.column;
                            var sourceColumn = node.source.parentName + '.' + node.source.column;
                            jsPlumb.selectEndpoints({ source: targetColumn }).each(function (endpoint) {
                                endpoint.connections.forEach(conn=> {
                                    if (conn.sourceId == sourceColumn && conn.targetId == targetColumn) {
                                        conn.removeClass('hoverLine');
                                    }
                                })
                                jsPlumb.repaint(targetColumn);
                            });
                            $("#"+node.target.parentName+"-cols").find("#"+node.target.parentName+"\\."+node.target.column).css("background-color", "#fff");
                            $("#"+node.source.parentName+"-cols").find("#"+node.source.parentName+"\\."+node.source.column).css("background-color", "#fff");
                        })
                    }
                    ul.append(li);
                });
                //根据节点类型找到不同模板各自的 添加端点 方法
                if (that['addEndpointOf' + item.type]) {
                    that['addEndpointOf' + item.type](item)
                }
            });
            //模板渲染好了、锚点也设置好了，最后根据关系连线
            this.finalConnect(json.nodes, json.relations)
        },

        //根据关系连线
        finalConnect: function (nodes, relations) {
            var that = this;
            nodes.forEach(function (node) {
                //RS表要排除，
                if (node.id != 'RS' && node.type != 'RS') {
                    //遍历的每个表的每个列（除了RS表，血缘关系是个有向无环图啦）
                    node.columns.forEach(col => {
                        relations.forEach(relation => {
                            var relName = relation.source.parentName + '.' + relation.source.column;
                            var nodeName = node.name + '.' + col.name;
                            //如果关系中的起始关系等于当前表节点的列，就连接
                            if (relName === nodeName) {
                                //这里sourceUUID、targetUUID应该和addEndpointOfXXX方法里设置的uuid一致
                                //sourceUUID尾端的'-Right'应该和setRSPoint等方法uuid那里设置的一致
                                var sourceUUID = nodeName + '-Right';
                                var targetUUID = relation.target.parentName + '.' + relation.target.column + '-Left';

                                //终于连线了！
                                that.connectEndpoint(sourceUUID, targetUUID);


                                //鼠标移动到连接线上后，两边的列高亮的效果利用jsPlumb事件实现
                                //jsPlumb的事件doc https://github.com/jsplumb/jsplumb/blob/da6688b86fbfba621bf3685e4431a4d9be7213b4/doc/wiki/events.md
                                jsPlumb.unbind('mouseover')
                                jsPlumb.bind("mouseover", function (conn, originalEvent) {
                                    // console.log(conn);
                                    var tar_name = conn.targetId.split(".");
                                    //找到所有需要高亮的列
                                    var activeNodes = that.findActiveNode(relations, tar_name[0], tar_name[1]);
                                    //将所有相关列和线高亮显示
                                    // console.log(activeNodes)
                                    activeNodes.forEach(node=>{
                                        var targetColumn = node.target.parentName + '.' + node.target.column;
                                        var sourceColumn = node.source.parentName + '.' + node.source.column;
                                        jsPlumb.selectEndpoints({ source: targetColumn }).each(function (endpoint) {
                                            endpoint.connections.forEach(conn=> {
                                                // 只有当连线中存储的源，目标和当前一致时，才进行高亮显示
                                                if (conn.sourceId == sourceColumn && conn.targetId == targetColumn) {
                                                    conn.addClass('hoverLine')
                                                }
                                            })
                                            jsPlumb.repaint(targetColumn);
                                        });
                                        //注意 . 的转义，参考 https://blog.csdn.net/qq_44831907/article/details/120899676
                                        $("#"+node.target.parentName+"-cols").find("#"+node.target.parentName+"\\."+node.target.column).css("background-color", "#faebd7");
                                        $("#"+node.source.parentName+"-cols").find("#"+node.source.parentName+"\\."+node.source.column).css("background-color", "#faebd7");
                                    });
                                });
                                jsPlumb.unbind('mouseout')
                                jsPlumb.bind("mouseout", function (conn, originalEvent) {
                                    var tar_name = conn.targetId.split(".");
                                    var activeNodes = that.findActiveNode(relations,tar_name[0],tar_name[1])

                                    //将所有相关字段恢复默认显示
                                    activeNodes.forEach(node=>{
                                        var targetColumn = node.target.parentName + '.' + node.target.column;
                                        var sourceColumn = node.source.parentName + '.' + node.source.column;
                                        jsPlumb.selectEndpoints({ source: targetColumn }).each(function (endpoint) {
                                            endpoint.connections.forEach(conn=> {
                                                if (conn.sourceId == sourceColumn && conn.targetId == targetColumn) {
                                                    conn.removeClass('hoverLine');
                                                }
                                            })
                                            jsPlumb.repaint(targetColumn);
                                        });
                                        $("#"+node.target.parentName+"-cols").find("#"+node.target.parentName+"\\."+node.target.column).css("background-color", "#fff");
                                        $("#"+node.source.parentName+"-cols").find("#"+node.source.parentName+"\\."+node.source.column).css("background-color", "#fff");
                                    })
                                });
                            }
                        });
                    });
                }
            })
        },


        findActiveNode: function (relations, parentName, column) {
            return this.findChildNode(relations, parentName, column).concat(this.findParentNode(relations, parentName, column))
        },
        findChildNode: function (relations, parentName, column) {
            var result = [];
            relations.forEach(relation => {
                if (relation.source.parentName == parentName && relation.source.column == column) {
                    // 组成一个pair对
                    var targetParentName = relation.target.parentName;
                    var targetColumn = relation.target.column;
                    result.push({'source': {'parentName': parentName, 'column': column}, 'target': {'parentName': targetParentName, 'column': targetColumn}})
                    result = result.concat(this.findChildNode(relations, relation.target.parentName, relation.target.column))
                }
            })
            return result
        },
        findParentNode: function (relations, parentName, column) {
            var result = [];
            relations.forEach(relation => {
                if (relation.target.parentName == parentName && relation.target.column == column) {
                    // 组成一个pair对
                    var sourceParentName = relation.source.parentName;
                    var sourceColumn = relation.source.column;
                    result.push({'source': {'parentName': sourceParentName, 'column': sourceColumn}, 'target': {'parentName': parentName, 'column': column}})
                    result = result.concat(this.findParentNode(relations, relation.source.parentName, relation.source.column))
                }
            })
            return result
        },

        addEndpointOfOrigin: function (node) {
            //节点设置可拖拽
            node.columns = Array.from(node.columns);
            node.columns.forEach(function (col) {
                //这里的id应该和draw方法里设置的id保持一致
                setOriginPoint(node.id + '.' + col.name, 'Right')
            })
        },

        addEndpointOfMiddle: function (node) {
            node.columns = Array.from(node.columns);
            node.columns.forEach(function (col) {
                setMiddlePoint(node.id + '.' + col.name, 'Middle')
            })
        },

        addEndpointOfUNION: function (node) {
            node.columns = Array.from(node.columns);
            node.columns.forEach(function (col) {
                setMiddlePoint(node.id + '.' + col.name, 'UNION')
            })
        },

        addEndpointOfRS: function (node) {
            node.columns = Array.from(node.columns);
            node.columns.forEach(function (col) {
                setRSPoint(node.id + '.' + col.name, 'Left')
            })
        },


        connectEndpoint: function (from, to) {
            // 通过编码连接endPoint需要用到uuid
            jsPlumb.connect(
                {
                    uuids: [from, to],
                    //StateMachine Bezier Flowchart Straight
                    connector: ['StateMachine']
                });
        },

        getTemplate: function (node) {
            return $('#tpl-' + node.type).html();
        },
    }

    function initPanZoom() {
        const mainContainer = jsPlumb.getContainer();
        const mainContainerWrap = mainContainer.parentNode;
        const pan = panzoom(mainContainer, {
            smoothScroll: false,
            bounds: true,
            zoomDoubleClickSpeed: 1,
            minZoom: 0.1,
            maxZoom: 2,
            //设置滚动缩放的组合键，默认不需要组合键
            beforeWheel: (e) => {
            },
            beforeMouseDown: function (e) {
              // allow mouse-down panning only if altKey is down. Otherwise - ignore
              var shouldIgnore = e.ctrlKey;
              return shouldIgnore;
            }
        });
        jsPlumb.mainContainerWrap = mainContainerWrap;
        jsPlumb.pan = pan;
        // 缩放时设置jsPlumb的缩放比率
        pan.on("zoom", e => {
            const {
            x,
            y,
            scale
            } = e.getTransform();
            this.jsPlumb.setZoom(scale);
        });
        pan.on("panend", (e) => {
            const {
            x,
            y,
            scale
            } = e.getTransform();
        })
    
    }
})()
