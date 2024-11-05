// borehole-style.service.ts

import { Injectable } from '@angular/core';
import { serialize } from '@thi.ng/hiccup';
import { StyleService } from './style.service';
@Injectable()
export class BoreholeStyleService {
  constructor() {}

  /**
   * Fetches the SLD_BODY parameter used to style a WMS request for boreholes
   *
   * @param params - Object containing layerName, styleName, and showNoneHylogged
   * @returns style sheet in string form
   * @throws Error if unable to generate SLD
   */
  public static getSld(
    layerName: string,
    styleName: string,
    color: string = '#2242c7'
  ): string {
    try {
      const xmlHeader = serialize([
        '?xml',
        { version: '1.0', encoding: 'UTF-8' },
      ]);
      const styledLayerAttrs = {
        version: '1.0.0',
        xmlns: 'http://www.opengis.net/ogc',
        'xmlns:sld': 'http://www.opengis.net/sld',
        'xmlns:ogc': 'http://www.opengis.net/ogc',
        'xmlns:gml': 'http://www.opengis.net/gml',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation':
          'http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd',
      };
      const styledLayerDesc = (body: any) => [
        'sld:StyledLayerDescriptor',
        styledLayerAttrs,
        body,
      ];
      const namedLayer = (body: string) => ['sld:NamedLayer', null, body];
      const name = (nameStr: string) => ['sld:Name', null, nameStr];
      const userStyle = (body: string) => ['sld:UserStyle', null, body];

      const featureTypeStyle = this.getStandardFeatureTypeStyle(
        styleName,
        color
      );

      const body1 = serialize(name(styleName)) + featureTypeStyle;
      const body2 = serialize(name(layerName)) + serialize(userStyle(body1));
      return xmlHeader + serialize(styledLayerDesc(namedLayer(body2)));
    } catch (error) {
      console.error('Error generating SLD:', error);
      throw new Error('Unable to generate SLD');
    }
  }

  private static getStandardFeatureTypeStyle(
    styleName: string,
    color: string
  ): string {
    let rules: string[] = [];

    // Rule for all boreholes "gsmlp:BoreholeView"
    rules.push(StyleService.getRule(styleName, '', color, color, false, false));

    return serialize(['sld:FeatureTypeStyle', null, rules.join('')]);
  }
}
