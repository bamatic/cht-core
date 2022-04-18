import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EnketoTranslationService {
  private withElements(nodes:any) {
    return Array
      .from(nodes)
      .filter((node:any) => node.nodeType === Node.ELEMENT_NODE);
  }

  private findChildNode(root, childNodeName) {
    return this
      .withElements(root.childNodes)
      .find((node:any) => node.nodeName === childNodeName);
  }

  private getHiddenFieldListRecursive(nodes, prefix, current) {
    nodes.forEach(node => {
      const path = prefix + node.nodeName;

      if (current.includes(path)) {
        return;
      }

      const attr = node.attributes.getNamedItem('tag');
      const dbDocAttribute = node.attributes.getNamedItem('db-doc');
      if ((attr && attr.value === 'hidden') || (dbDocAttribute && dbDocAttribute.value === 'true')) {
        current.push(path);
      } else {
        const children = this.withElements(node.childNodes);
        this.getHiddenFieldListRecursive(children, path + '.', current);
      }
    });
  }

  private nodesToJs(data, repeatPaths?, path?) {
    repeatPaths = repeatPaths || [];
    path = path || '';
    const result = {};
    this.withElements(data).forEach((n:any) => {
      const typeAttribute = n.attributes.getNamedItem('type');
      const updatedPath = path + '/' + n.nodeName;
      let value;

      const hasChildren = this.withElements(n.childNodes).length > 0;
      if (hasChildren) {
        value = this.nodesToJs(n.childNodes, repeatPaths, updatedPath);
      } else if (typeAttribute && typeAttribute.value === 'binary') {
        // this is attached to the doc instead of inlined
        value = '';
      } else {
        value = n.textContent;
      }

      if (repeatPaths.indexOf(updatedPath) !== -1) {
        if (!result[n.nodeName]) {
          result[n.nodeName] = [];
        }
        result[n.nodeName].push(value);
      } else {
        result[n.nodeName] = value;
      }
    });
    return result;
  }

  private repeatsToJs(data) {
    const repeatNode:any = this.findChildNode(data, 'repeat');
    if(!repeatNode) {
      return;
    }

    const repeats = {};

    this.withElements(repeatNode.childNodes).forEach((repeated:any) => {
      const key = repeated.nodeName + '_data';
      if(!repeats[key]) {
        repeats[key] = [];
      }
      repeats[key].push(this.nodesToJs(repeated.childNodes));
    });

    return repeats;
  }

  private findCurrentElement(elem, name, childMatcher) {
    if (childMatcher) {
      const matcher = childMatcher(name);
      const found = elem.find(matcher);
      if (found.length > 1) {
        console.warn(`Enketo bindJsonToXml: Using the matcher "${matcher}" we found ${found.length} elements. ` +
          'We should only ever bind one.', elem, name);
      }
      return found;
    } else {
      return elem.children(name);
    }
  }

  bindJsonToXml(elem, data, childMatcher?) {
    Object.keys(data).forEach((key) => {
      const value = data[key];
      const current = this.findCurrentElement(elem, key, childMatcher);
      if (value === null || typeof value !== 'object') {
        current.text(value);
        return;
      }

      if (Array.isArray(value)) {
        // Enketo will remove all template elements
        // https://github.com/enketo/enketo-core/blob/51c5c2f494f1515a67355543b435f6aaa4b151b4/src/js/form-model.js#L436-L451
        current.removeAttr('jr:template');
        current.removeAttr('template');
        const parent = current.parent();
        current.remove();

        value.forEach((valueEntry) => {
          const clone = current.clone();
          parent.append(clone);
          this.bindJsonToXml(clone, valueEntry);
        });
        return;
      }

      if (current.children().length) {
        // childMatcher intentionally does not recurse. It exists to
        // allow the initial layer of binding to be flexible.
        return this.bindJsonToXml(current, value);
      }

      current.text(value._id);
    });
  }


  getHiddenFieldList (model) {
    model = $.parseXML(model).firstChild;
    if (!model) {
      return;
    }
    const children = this.withElements(model.childNodes);
    const fields = [];
    this.getHiddenFieldListRecursive(children, '', fields);
    return fields;
  }

  getRepeatPaths(formXml) {
    return $(formXml)
      .find('repeat[nodeset]')
      .map((idx, element) => {
        return $(element).attr('nodeset');
      })
      .get();
  }

  reportRecordToJs(record, formXml?) {
    const root = $.parseXML(record).firstChild;
    if (!formXml) {
      return this.nodesToJs(root.childNodes);
    }
    const repeatPaths = this.getRepeatPaths(formXml);
    return this.nodesToJs(root.childNodes, repeatPaths, '/' + root.nodeName);
  }

  /*
   * Given a record, returns the parsed doc and associated docs
   * result.doc: the main document
   * result.siblings: more documents at the same level. These docs are docs
   *   that must link to the main doc, but the main doc must also link to them,
   *   for example the main doc may be a place, and a CHW a sibling.
   *   see: contacts-edit.component.ts:saveSiblings
   * result.repeats: documents from repeat nodes. These docs are simple docs
   *   that we wish to save independently of the main document.
   *   see: contacts-edit.component.ts:saveRepeated
   */
  contactRecordToJs(record) {
    const root = $.parseXML(record).firstChild;
    const result:any = {
      doc: null,
      siblings: {},
    };

    const repeats = this.repeatsToJs(root);
    if (repeats) {
      result.repeats = repeats;
    }

    const NODE_NAMES_TO_IGNORE = ['meta', 'inputs', 'repeat'];

    this
      .withElements(root.childNodes)
      .filter((node:any) => !NODE_NAMES_TO_IGNORE.includes(node.nodeName) && node.childElementCount > 0)
      .forEach((child:any) => {
        if (!result.doc) {
          // First child is the main result, rest are siblings
          result.doc = this.nodesToJs(child.childNodes);
          return;
        }
        result.siblings[child.nodeName] = this.nodesToJs(child.childNodes);
      });

    return result;
  }
}
