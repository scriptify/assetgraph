/*global module, require*/
var util = require('util'),
    _ = require('underscore'),
    step = require('step'),
    uglify = require('uglify'),
    error = require('../error'),
    memoizeAsyncAccessor = require('../memoizeAsyncAccessor'),
    relations = require('../relations'),
    Base = require('./Base').Base;

function JavaScript(config) {
    Base.call(this, config);
}

util.inherits(JavaScript, Base);

JavaScript.makeBundle = function (javaScripts, cb) {
    step(
        function () {
            var group = this.group();
            javaScripts.forEach(function (javaScript) {
                javaScript.getParseTree(group());
            });
        },
        error.passToFunction(cb, function (parseTrees) {
            cb(null, new JavaScript({
                parseTree: [
                    'toplevel',
                    [].concat.apply([], parseTrees.map(function (parseTree) {
                        return parseTree[1];
                    }))
                ]
            }));
        })
    );
};

_.extend(JavaScript.prototype, {
    contentType: 'application/javascript', // TODO: Double check that this is everyone's recommended value

    getParseTree: memoizeAsyncAccessor('parseTree', function (cb) {
        var that = this;
        this.getOriginalSrc(error.passToFunction(cb, function (src) {
            cb(null, uglify.parser.parse(src));
        }));
    }),

    serialize: function (cb, minify) {
        this.getParseTree(error.passToFunction(cb, function (parseTree) {
            if (minify) {
                parseTree = uglify.uglify.ast_squeeze(uglify.uglify.ast_mangle(parseTree));
            }
            cb(null, uglify.uglify.gen_code(parseTree, !minify));
        }));
    },

    getOriginalRelations: memoizeAsyncAccessor('originalRelations', function (cb) {
        var that = this;
        this.getParseTree(error.passToFunction(cb, function (parseTree) {
            var callbackCalled = false;
            // Avoid calling the callback more than once
            function finished(err, relations) {
                if (!callbackCalled) {
                    cb(err, relations);
                    callbackCalled = true;
                }
            }
            var stack = [],
                originalRelations = [];

            function walk(node) {
                if (node[0] === 'stat' && Array.isArray(node[1]) &&
                    node[1][0] === 'call' && Array.isArray(node[1][1]) && node[1][1][0] === 'dot' &&
                    Array.isArray(node[1][1][1]) && node[1][1][1][0] === 'name' && node[1][1][1][1] === 'one') {

                    if (/^(?:lazyInlude|include)$/.test(node[1][1][2])) {
                        if (Array.isArray(node[1][2]) && node[1][2].length === 1 &&
                            Array.isArray(node[1][2][0]) && node[1][2][0][0] === 'string') {

                            originalRelations.push(new relations['JavaScript' + (node[1][1][2] === 'include' ? 'Static' : 'Lazy') + 'Include']({
                                from: that,
                                node: node,
                                parentNode: stack[stack.length - 1],
                                assetConfig: node[1][2][0][1]
                            }));
                        } else {
                            finished(new Error("Invalid one.include syntax"));
                        }
                    }
/*
                    else if (node[1][2] === 'getStaticUrl') {
                        if (Array.isArray(node[2]) && node[2].length === 1 &&
                            Array.isArray(node[2][0]) && node[2][0][0] === 'string') {

                            originalRelations.push(new relations.JavaScriptStaticUrl({
                                from: that,
                                parentNode: stack[stack.length - 1],
                                node: node,
                                assetConfig: node[2][1]
                            }));
                        } else {
                            finished(new Error("Invalid one.getStaticUrl syntax"));
                        }
                    }
*/
                } else if (node[0] === 'if' && node[1][0] === 'dot' &&
                           node[1][1][0] === 'name' && node[1][1][1] === 'one' &&
                           node[1][2] === 'buildDevelopment') {
                    originalRelations.push(new relations.JavaScriptIfEnvironment({
                        from: that,
                        parentNode: stack[stack.length - 1],
                        node: node,
                        environment: node[1][2],
                        assetConfig: {
                            type: 'JavaScript',
                            originalSrc: true, // FIXME
                            parseTree: node[2]
                        }
                    }));
                }

                for (var i=0 ; i<node.length ; i++) {
                    if (Array.isArray(node[i])) {
                        stack.push(node);
                        walk(node[i]);
                        stack.pop();
                    }
                }
            }
            walk(parseTree);
            finished(null, originalRelations);
        }));
    }),

    attachRelation: function (relation, position, adjacentRelation) {
        position = position || 'after';
        var parentNode = adjacentRelation.parentNode;
        _.extend(relation, {
            from: this,
            parentNode: parentNode,
            node: relation.createNode(this.parseTree)
        });
        var i = parentNode.indexOf(adjacentRelation.node) + (position === 'after' ? 1 : 0);
        parentNode.splice(i, 0, relation.node);
    },

    detachRelation: function (relation) {
        relation.parentNode.splice(relation.parentNode.indexOf(relation.node), 1);
        delete relation.node;
        delete relation.parentNode;
    }
});

exports.JavaScript = JavaScript;
