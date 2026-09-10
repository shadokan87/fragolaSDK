import { source } from './lib/source';
import { findNeighbour } from 'fumadocs-core/page-tree';

const tree = source.getPageTree();
console.log("Tree children:", tree.children.map(c => c.type === 'page' ? c.url : c.type));
