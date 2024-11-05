// borehole-style.service.ts

import { Injectable } from '@angular/core';
import { serialize } from '@thi.ng/hiccup';
import { StyleService } from './style.service';
// Define constants
const XML_VERSION = '1.0';
const XML_ENCODING = 'UTF-8';
const SLD_VERSION = '1.0.0';
const XMLNS = 'http://www.opengis.net/ogc';
const XMLNS_SLD = 'http://www.opengis.net/sld';
const XMLNS_OGC = 'http://www.opengis.net/ogc';
const XMLNS_GML = 'http://www.opengis.net/gml';
const XMLNS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const XSI_SCHEMA_LOCATION =
  'http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd';

// Define interfaces
interface AnalyticsResults {
    errorBoreholes: string[];
    failBoreholes: string[];
    passBoreholes: string[];
  }
@Injectable()
export class RemanentAutoStyleService {
  constructor() {}

  /**
     * Fetches the SLD_BODY parameter used to style a WMS request for boreholes
     *
     * @param params - Object containing layerName, styleName, and showNoneHylogged
     * @returns style sheet in string form
     * @throws Error if unable to generate SLD
     */
  private static REMANENT_ANOMALIESAUTOSEARCH_TYPE = "RemAnomAutoSearch:AutoSearchAnomalies";

  public static getSld(filter: string, color: string, styles: string): string {
    const xmlHeader = serialize(['?xml', { 'version': '1.0', 'encoding': 'UTF-8' }]);
    const styledLayerAttrs = {
      'version': '1.0.0',
      'xsi:schemaLocation': 'http://www.opengis.net/sld StyledLayerDescriptor.xsd http://remanentanomalies.csiro.au/schemas/anomaly.xsd',
      'xmlns': 'http://www.opengis.net/sld',
      'xmlns:ogc': 'http://www.opengis.net/ogc',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      'xmlns:gml': 'http://www.opengis.net/gml',
      'xmlns:RemAnom': 'http://remanentanomalies.csiro.au',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    };

    const styledLayerDesc = (body: any) => ['StyledLayerDescriptor', styledLayerAttrs, body];
    const namedLayer = (body: string) => ['NamedLayer', null, body];
    const name = (nameStr: string) => ['Name', null, nameStr];
    const userStyle = (body: string) => ['UserStyle', null, body];

    const rules = this.generateRules();
    const featureTypeStyle = ['FeatureTypeStyle', null, rules];

    const body1 = serialize(name('portal-style')) +
                  serialize(['Title', null, 'portal-style']) +
                  serialize(['Abstract', null, 'portal-style']) +
                  serialize(['IsDefault', null, '1']) +
                  serialize(featureTypeStyle);

    const body2 = serialize(name(this.REMANENT_ANOMALIESAUTOSEARCH_TYPE)) + serialize(userStyle(body1));

    return xmlHeader + serialize(styledLayerDesc(namedLayer(body2)));
  }

  private static generateRules(): string {
    const rotationRanges = [
      { min: 0, max: 30, color: '#0000FF' },
      { min: 30, max: 60, color: '#00FFFF' },
      { min: 60, max: 90, color: '#00FF00' },
      { min: 90, max: 120, color: '#FFFF00' },
      { min: 120, max: 150, color: '#FFA500' },
      { min: 150, max: 180, color: '#FF0000' }
    ];

    return rotationRanges.map(range => this.generateRule(range.min, range.max, range.color)).join('');
  }

  private static generateRule(min: number, max: number, color: string): string {
    return serialize(['Rule', null, [
      ['Name', null, `Rotation ${min}-${max}`],
      ['Title', null, `Rotation between ${min} and ${max} degrees`],
      ['Abstract', null, `Rotation of the magnetisation direction away from IGRF between ${min} and ${max} degrees`],
      ['ogc:Filter', null, [
        ['ogc:And', null, [
          ['ogc:PropertyIsGreaterThanOrEqualTo', null, [
            ['ogc:PropertyName', null, 'rotation_from_igrf'],
            ['ogc:Literal', null, min.toString()]
          ]],
          ['ogc:PropertyIsLessThan', null, [
            ['ogc:PropertyName', null, 'rotation_from_igrf'],
            ['ogc:Literal', null, max.toString()]
          ]]
        ]]
      ]],
      ['PolygonSymbolizer', null, [
        ['Fill', null, [
          ['CssParameter', { name: 'fill' }, color],
          ['CssParameter', { name: 'fill-opacity' }, '0.5']
        ]],
        ['Stroke', null, [
          ['CssParameter', { name: 'stroke' }, color],
          ['CssParameter', { name: 'stroke-width' }, '1']
        ]]
      ]]
    ]]);
  }
}
