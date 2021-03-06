const HtmlResourceHint = require('./HtmlResourceHint');

/**
 * @extends {HtmlResourceHint}
 *
 * Implementation of https://www.w3.org/TR/resource-hints/#prefetch
 */
class HtmlPrefetchLink extends HtmlResourceHint {
  static getRelationsFromNode(node) {
    if (
      node.nodeType === node.ELEMENT_NODE &&
      node.matches('link[href][rel~=prefetch]')
    ) {
      return {
        type: 'HtmlPrefetchLink',
        as: node.getAttribute('as') || undefined,
        href: node.getAttribute('href'),
        node
      };
    }
  }

  attach(position, adjacentRelation) {
    this.node = this.from.parseTree.createElement('link');
    this.node.setAttribute('rel', 'prefetch');

    if (this.contentType && this.contentType !== 'application/octet-stream') {
      this.node.setAttribute('type', this.contentType);
    }

    if (this.as) {
      this.node.setAttribute('as', this.as);

      if (['font', 'fetch'].includes(this.as)) {
        this.node.setAttribute('crossorigin', 'anonymous');
      }
    }

    return super.attach(position, adjacentRelation);
  }
}

module.exports = HtmlPrefetchLink;
