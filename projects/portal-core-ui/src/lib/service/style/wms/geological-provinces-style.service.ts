import { Injectable } from '@angular/core';
import { serialize } from '@thi.ng/hiccup';

/*
 * This is a static class designed to return style sheets for Geological Provinces layer
 */
@Injectable()
export class GeologicalProvinceStyleService {
    /**
     * Fetches the SLD_BODY parameter used to style a WMS request
     *
     * @param layerName - name of WMS layer e.g. 'gml:ProvinceFullExtent'
     * @param name - name filter for the provinces
     * @param filter - additional filter string
     * @return style sheet in string form
     */
    public static getSld(layerName: string, name: string, filter: string): string {
        const xmlHeader = serialize(['?xml', { 'version': '1.0', 'encoding': 'UTF-8' }]);
        const styledLayerAttrs = {
            'version': '1.0.0',
            'xmlns': 'http://www.opengis.net/sld',
            'xmlns:ogc': 'http://www.opengis.net/ogc',
            'xmlns:xlink': 'http://www.w3.org/1999/xlink',
            'xmlns:gml': 'http://www.opengis.net/gml',
            'xmlns:gsml': 'urn:cgi:xmlns:CGI:GeoSciML:2.0',
            'xmlns:sld': 'http://www.opengis.net/sld',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation': 'http://www.opengis.net/sld StyledLayerDescriptor.xsd',
            'xmlns:gsmlp': 'http://xmlns.geosciml.org/geosciml-portrayal/4.0'
        };
        const styledLayerDesc = (body: any) => ['StyledLayerDescriptor', styledLayerAttrs, body];
        const namedLayer = (body: string) => ['NamedLayer', null, body];
        const userStyle = (body: string) => ['UserStyle', null, body];
        
        const styleBody = this.getStyleBody(layerName, filter);
        
        const body1 = serialize(['Name', null, 'portal-style']) +
                      serialize(['Title', null, 'portal-style']) +
                      serialize(['IsDefault', null, '1']) +
                      styleBody;
        
        const body2 = serialize(['Name', null, layerName]) + serialize(userStyle(body1));
        
        return xmlHeader + serialize(styledLayerDesc(namedLayer(body2)));
    }

    private static getStyleBody(layerName: string, filter: string): string {
        return serialize(['FeatureTypeStyle', null, [
            ['Rule', null, [
                ['Name', null, 'Provinces'],
                filter,
                ['PolygonSymbolizer', null, [
                    ['Fill', null, [
                        ['CssParameter', { name: 'fill' }, [
                            ['ogc:Function', { name: 'Recode' }, [
                                ['ogc:Function', { name: 'IEEERemainder' }, [
                                    ['ogc:PropertyName', null, 'OBJECTID'],
                                    ['ogc:Function', { name: 'parseInt' }, [
                                        ['ogc:Literal', null, '9']
                                    ]]
                                ]],
                                ['ogc:Literal', null, '-4'],
                                ['ogc:Literal', null, '#8dd3c7'],
                                ['ogc:Literal', null, '-3'],
                                ['ogc:Literal', null, '#ffffb3'],
                                ['ogc:Literal', null, '-2'],
                                ['ogc:Literal', null, '#bebada'],
                                ['ogc:Literal', null, '-1'],
                                ['ogc:Literal', null, '#fb8072'],
                                ['ogc:Literal', null, '0'],
                                ['ogc:Literal', null, '#80b1d3'],
                                ['ogc:Literal', null, '1'],
                                ['ogc:Literal', null, '#fdb462'],
                                ['ogc:Literal', null, '2'],
                                ['ogc:Literal', null, '#b3de69'],
                                ['ogc:Literal', null, '3'],
                                ['ogc:Literal', null, '#fccde5'],
                                ['ogc:Literal', null, '4'],
                                ['ogc:Literal', null, '#d9d9d9']
                            ]]
                        ]],
                        ['CssParameter', { name: 'fill-opacity' }, '0.4']
                    ]],
                    ['Stroke', null, [
                        ['CssParameter', { name: 'stroke' }, '#000000'],
                        ['CssParameter', { name: 'stroke-width' }, '0.5']
                    ]]
                ]],
                ['TextSymbolizer', null, [
                    ['Label', null, [
                        ['ogc:PropertyName', null, 'NAME']
                    ]],
                    ['LabelPlacement', null, [
                        ['PointPlacement', null, [
                            ['AnchorPoint', null, [
                                ['AnchorPointX', null, '0.5'],
                                ['AnchorPointY', null, '0.5']
                            ]]
                        ]]
                    ]],
                    ['Font', null, [
                        ['CssParameter', { name: 'font-family' }, 'Arial'],
                        ['CssParameter', { name: 'font-size' }, '12'],
                        ['CssParameter', { name: 'font-style' }, 'normal'],
                        ['CssParameter', { name: 'font-weight' }, 'normal']
                    ]],
                    ['Fill', null, [
                        ['CssParameter', { name: 'fill' }, '#000000']
                    ]]
                ]]
            ]]
        ]]);
    }
}