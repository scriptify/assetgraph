/*global describe, it*/
const expect = require('../unexpected-with-plugins');
const _ = require('lodash');
const AssetGraph = require('../../lib/AssetGraph');

describe('relations/HtmlPictureSource test', function () {
    it('should handle a test case with an existing <picture><source src="..."></picture> construct', async function () {
        const assetGraph = await new AssetGraph({root: __dirname + '/../../testdata/relations/HtmlPictureSource/'})
            .loadAssets('index.html')
            .populate({
                startAssets: { isInitial: true },
                followRelations: () => false
            });

        expect(assetGraph, 'to contain relations including unresolved', 'HtmlPictureSource', 2);
        assetGraph.findAssets({type: 'Html'})[0].url = 'http://example.com/foo/bar.html';
        assetGraph.findRelations({}, true).forEach(function (relation) {
            relation.hrefType = 'relative';
        });
        expect(_.map(assetGraph.findRelations({}, true), 'href'), 'to equal', [
            '../image.png',
            '../otherImage.jpg'
        ]);
    });
});
