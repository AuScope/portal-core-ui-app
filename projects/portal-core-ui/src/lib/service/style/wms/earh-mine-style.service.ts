import { Injectable } from '@angular/core';
import { serialize } from '@thi.ng/hiccup';
import { StyleService } from './style.service'

/*
 * This is a static class designed to return style sheets for Mine Filter layers
 */
@Injectable()
export class EarthMineStyleService {
    /**
     * Fetches the SLD_BODY parameter used to style a WMS request
     *
     * @method getSld
     * @param serviceUrl - URL of the service
     * @param filter - filter string
     * @return style sheet in string form
     */
    public static getSld(layerName: string, filter: string, color: string = '#ed9c38'): string {
        
        const xmlHeader = serialize(['?xml', { 'version': '1.0', 'encoding': 'UTF-8' }]);
        const styledLayerAttrs = this.getNamespaces();

        const styledLayerDesc = (body: any) => ['StyledLayerDescriptor', styledLayerAttrs, body];
        const namedLayer = (body: string) => ['NamedLayer', null, body];
        const name = (nameStr: string) => ['Name', null, nameStr];
        const userStyle = (body: string) => ['UserStyle', null, [
            ['Title', null, layerName],
            ['FeatureTypeStyle', null, body]
        ]];

        const pointSymbolizer = [
            'Rule', 
            null, 
            [
                // filter,
                ['PointSymbolizer', null, [
                    ['Graphic', null, [
                        ['Mark', null, [
                            ['WellKnownName', null, 'circle'],
                            ['Fill', null, [
                                ['CssParameter', { 'name': 'fill' }, color],
                                ['CssParameter', { 'name': 'fill-opacity' }, '0.4']
                            ]],
                            ['Stroke', null, [
                                ['CssParameter', { 'name': 'stroke' }, color],
                                ['CssParameter', { 'name': 'stroke-width' }, '1']
                            ]]
                        ]],
                        ['Size', null, '8']
                    ]]
                ]]
            ]
        ];

        const body = serialize(name(layerName)) + 
                    serialize(userStyle(serialize(pointSymbolizer)));

        return xmlHeader + serialize(styledLayerDesc(namedLayer(body)));
    }
    private static getNamespaces() {
        // This would need to be coordinated with your service configuration
        return {
            'version': '1.0.0',
            'xmlns': 'http://www.opengis.net/ogc',
            'xmlns:sld': 'http://www.opengis.net/sld',
            'xmlns:ogc': 'http://www.opengis.net/ogc',
            'xmlns:gml': 'http://www.opengis.net/gml',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xmlns:er': 'urn:cgi:xmlns:GGIC:EarthResource:1.1',
            'xmlns:gsml': 'urn:cgi:xmlns:CGI:GeoSciML:2.0',
            'xsi:schemaLocation': 'http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd'
        };
    }
}