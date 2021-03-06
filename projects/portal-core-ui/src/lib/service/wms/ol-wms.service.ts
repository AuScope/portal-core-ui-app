import { throwError as observableThrowError, Observable } from 'rxjs';

import { catchError, map } from 'rxjs/operators';
import { Injectable, Inject } from '@angular/core';
import { LayerModel } from '../../model/data/layer.model';
import { OnlineResourceModel } from '../../model/data/onlineresource.model';
import { LayerHandlerService } from '../cswrecords/layer-handler.service';
import { OlMapObject } from '../openlayermap/ol-map-object';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import olMap from 'ol/Map';
import olTile from 'ol/layer/Tile';
import olTileWMS from 'ol/source/TileWMS';
import * as olProj from 'ol/proj';
import * as extent from 'ol/extent';
import { Constants } from '../../utility/constants.service';
import { UtilitiesService } from '../../utility/utilities.service';
import { RenderStatusService } from '../cesium-map/renderstatus/render-status.service';
import { MinTenemStyleService } from '../style/wms/min-tenem-style.service';
import { LayerStatusService } from '../../utility/layerstatus.service';


/**
 * Use Open Layers to add layer to map. This service class adds WMS layer to the map
 */
@Injectable()
export class OlWMSService {
  private map: olMap;
  constructor(
    private layerHandlerService: LayerHandlerService,
    private olMapObject: OlMapObject,
    private http: HttpClient,
    private renderStatusService: RenderStatusService,
    private layerStatusService: LayerStatusService,
    @Inject('env') private env,
    @Inject('conf') private conf

  ) {
    this.map = this.olMapObject.getMap();
  }


  /**
   * A private helper used to check if the URL is too long
   */
  private wmsUrlTooLong(sldBody: string, layer: LayerModel): boolean {
    return (
      encodeURIComponent(sldBody).length > Constants.WMSMAXURLGET ||
      this.conf.forceAddLayerViaProxy.includes(layer.id)
    );
  }


  /**
   * Get WMS 1.3.0 related parameter
   * @param layers the wms layer
   * @param sld_body associated sld_body
   */
  public getWMS1_3_0param(
    layer: LayerModel,
    onlineResource: OnlineResourceModel,
    param,
    sld_body?: string
  ): any {
    const params = {
      // VT: if the parameter contains featureType, it mean we are targeting a different featureType e.g capdf layer
      LAYERS:
        param && param.featureType ? param.featureType : onlineResource.name,
      TILED: true,
      DISPLAYOUTSIDEMAXEXTENT: true,
      FORMAT: 'image/png',
      TRANSPARENT: true,
      VERSION: '1.3.0',
      WIDTH: Constants.TILE_SIZE,
      HEIGHT: Constants.TILE_SIZE,
      STYLES: param && param.styles ? param.styles : '',
    };

    if (sld_body) {
      /* ArcGIS cannot read base64 encoded styles */
      if (!UtilitiesService.isArcGIS(onlineResource) && this.wmsUrlTooLong(sld_body, layer)) {
        params['sld_body'] = window.btoa(sld_body);
      } else {
        params['sld_body'] = sld_body;
      }
    } else {
      params['sldUrl'] = this.getSldUrl(layer, onlineResource, param);
    }
    return params;
  }


  /**
   * get wms 1.1.0 related parameter
   * @param layer the WMS layer
   * @param onlineResource details of the online resource
   * @param param WMS parameters
   * @param sld_body associated SLD_BODY
   */
  public getWMS1_1param(
    layer: LayerModel,
    onlineResource: OnlineResourceModel,
    param: any,
    sld_body?: string
  ): any {
    const params = {
      // VT: if the parameter contains featureType, it mean we are targeting a different featureType e.g capdf layer
      LAYERS:
        param && param.featureType ? param.featureType : onlineResource.name,
      TILED: true,
      DISPLAYOUTSIDEMAXEXTENT: true,
      FORMAT: 'image/png',
      TRANSPARENT: true,
      VERSION: '1.1.1',
      WIDTH: Constants.TILE_SIZE,
      HEIGHT: Constants.TILE_SIZE
    };
    if (sld_body) {
      /* ArcGIS cannot read base64 encoded styles */
      if (!UtilitiesService.isArcGIS(onlineResource) && this.wmsUrlTooLong(sld_body, layer)) {
        params['sld_body'] = window.btoa(sld_body);
      } else {
        params['sld_body'] = sld_body;
      }
    } else {
      params['sldUrl'] = this.getSldUrl(layer, onlineResource, param);
    }
    return params;
  }


  /**
   * Get the SLD from the URL
   * @param sldUrl the url containing the SLD
   * @param usePost use a HTTP POST request
   * @param onlineResource details of resource
   * @return an Observable of the HTTP request
   */
  private getSldBody(
    sldUrl: string,
    usePost: Boolean,
    onlineResource: OnlineResourceModel,
    param?: any
  ): Observable<any> {

    // For ArcGIS mineral tenements layer we can get SLD_BODY parameter locally
    if (UtilitiesService.isArcGIS(onlineResource) && onlineResource.name === 'MineralTenement') {
      return Observable.create(observer => {
        param.styles = 'mineralTenementStyle';
        const x = MinTenemStyleService.getMineralTenementsSld(onlineResource.name, param.styles, param.ccProperty);
        observer.next(x);
        observer.complete();
      });
    }

    if (!sldUrl) {
      return Observable.create(observer => {
        observer.next(null);
        observer.complete();
      });
    }

    let httpParams = Object.getOwnPropertyNames(param).reduce(
      (p, key1) => p.set(key1, param[key1]),
      new HttpParams()
    );
    httpParams = UtilitiesService.convertObjectToHttpParam(httpParams, param);
    if (usePost) {
      return this.http
        .get(this.env.portalBaseUrl + sldUrl, {
          responseType: 'text',
          params: httpParams
        })
        .pipe(
          map(response => {
            return response;
          })
        );
    } else {
      return this.http
        .post(this.env.portalBaseUrl + sldUrl, httpParams.toString(), {
          headers: new HttpHeaders().set(
            'Content-Type',
            'application/x-www-form-urlencoded'
          ),
          responseType: 'text'
        })
        .pipe(
          map(response => {
            return response;
          }),
	  catchError((error: HttpResponse<any>) => {
            return observableThrowError(error);
          })
        );
    }
  }


  /**
   * Get the NvclFilter from the URL
   * @param sldUrl the url containing the sld
   * @return a observable of the http request
   */
  public getNvclFilter(layer: LayerModel, param?: any): Observable<any> {
    if (!param) {
      param = {};
    }
    const filterUrl = 'doNvclV2Filter.do';
    const usePost = this.wmsUrlTooLong(
      this.env.portalBaseUrl + filterUrl + param.toString(),
      layer
    );
    if (!filterUrl) {
      return Observable.create(observer => {
        observer.next(null);
        observer.complete();
      });
    }
    let httpParams = Object.getOwnPropertyNames(param).reduce(
      (p, key1) => p.set(key1, param[key1]),
      new HttpParams()
    );
    httpParams = UtilitiesService.convertObjectToHttpParam(httpParams, param);
    if (usePost) {
      return this.http
        .get(this.env.portalBaseUrl + '', {
          responseType: 'text',
          params: httpParams
        })
        .pipe(
          map(response => {
            return response;
          })
        );
    } else {
      return this.http
        .post(this.env.portalBaseUrl + filterUrl, httpParams.toString(), {
          headers: new HttpHeaders().set(
            'Content-Type',
            'application/x-www-form-urlencoded'
          ),
          responseType: 'text'
        })
        .pipe(
          map(response => {
            return response;
          }),
	  catchError((error: HttpResponse<any>) => {
            return observableThrowError(error);
          })
        );
    }
  }


  /**
   * Get the WMS style URL if proxyStyleUrl is valid
   * @method getSldUrl
   * @param layer - the layer we would like to retrieve the SLD for if proxyStyleUrl is defined
   * @param onlineResource - the onlineResource of the layer we are rendering
   * @param param - OPTIONAL - parameter to be passed into retrieving the SLD.Used in capdf
   * @return url - getUrl to retrieve sld
   */
  private getSldUrl(
    layer: LayerModel,
    onlineResource: OnlineResourceModel,
    param?: any
  ) {
    if (layer.proxyStyleUrl) {
      let httpParams = Object.getOwnPropertyNames(param).reduce(
        (p, key1) => p.set(key1, param[key1]),
        new HttpParams()
      );
      httpParams = UtilitiesService.convertObjectToHttpParam(httpParams, param);

      return '/' + layer.proxyStyleUrl + '?' + httpParams.toString();
    } else {
      return null;
    }
  }


  /**
   * Add a wms layer to the map
   * @method addLayer
   * @param layer the wms layer to add to the map.
   */
  public addLayer(layer: LayerModel, param?: any): void {
    if (!param) {
      param = {};
    }

    const wmsOnlineResources = this.layerHandlerService.getWMSResource(layer);

    for (const wmsOnlineResource of wmsOnlineResources) {
      if (
        UtilitiesService.filterProviderSkip(
          param.optionalFilters,
          wmsOnlineResource.url
        )
      ) {
        this.renderStatusService.skip(layer, wmsOnlineResource);
        continue;
      }
      if (
        this.layerStatusService.isEndpointFailing(
          layer.id,
          wmsOnlineResource
        )
      ) {
        this.renderStatusService.addResource(layer, wmsOnlineResource);
        this.renderStatusService.updateComplete(layer, wmsOnlineResource, true);
        continue;
      }
      const collatedParam = UtilitiesService.collateParam(
        layer,
        wmsOnlineResource,
        param
      );
      const usePost = this.wmsUrlTooLong(
        this.env.portalBaseUrl + layer.proxyStyleUrl + collatedParam.toString(),
        layer
      );
      this.getSldBody(layer.proxyStyleUrl, usePost, wmsOnlineResource, collatedParam).subscribe(
        response => {
          const me = this;
          const params = wmsOnlineResource.version.startsWith('1.3')
            ? this.getWMS1_3_0param(
                layer,
                wmsOnlineResource,
                collatedParam,
                response
              )
            : this.getWMS1_1param(
                layer,
                wmsOnlineResource,
                collatedParam,
                response
              );

          let wmsTile;

          let defaultExtent;
          if (wmsOnlineResource.geographicElements.length > 0) {
            const cswExtent = wmsOnlineResource.geographicElements[0];
            let lonlatextent = extent.buffer(
              [
                cswExtent.westBoundLongitude,
                cswExtent.southBoundLatitude,
                cswExtent.eastBoundLongitude,
                cswExtent.northBoundLatitude
              ],
              2
            );
            lonlatextent = extent.getIntersection(lonlatextent, [
              -180,
              -90,
              180,
              90
            ]);
            defaultExtent = olProj.transformExtent(
              lonlatextent,
              'EPSG:4326',
              Constants.MAP_PROJ
            );
          } else {
            defaultExtent = this.map
              .getView()
              .calculateExtent(this.map.getSize());
          }

          // ArcGIS does not respond to POST requests
          if (!UtilitiesService.isArcGIS(wmsOnlineResource) && this.wmsUrlTooLong(response, layer)) {
            wmsTile = new olTile({
              extent: defaultExtent,
              source: new olTileWMS({
                url: UtilitiesService.rmParamURL(wmsOnlineResource.url),
                params: params,
                serverType: 'geoserver',
                projection: Constants.MAP_PROJ, // VT: testing if this breaks anything. If not this will fix tas weird projection issue
                tileLoadFunction: function(image, src) {
                  me.imagePostFunction(image, src);
                }
              })
            });
          } else {
            wmsTile = new olTile({
              extent: defaultExtent,
              source: new olTileWMS({
                url: UtilitiesService.rmParamURL(wmsOnlineResource.url),
                params: params,
                serverType: 'geoserver',
                projection: Constants.MAP_PROJ, // VT: testing if this breaks anything. If not this will fix tas weird projection issue
                maxGetUrlLength: 2048
              })
            });
          }

          wmsTile.sldBody = response;
          wmsTile.onlineResource = wmsOnlineResource;
          wmsTile.layer = layer;

          me.renderStatusService.register(layer, wmsOnlineResource);
          wmsTile.getSource().on('tileloadstart', function(event) {
            me.renderStatusService.addResource(layer, wmsOnlineResource);
          });

          wmsTile.getSource().on('tileloadend', function(event) {
            me.renderStatusService.updateComplete(layer, wmsOnlineResource);
          });

          wmsTile.getSource().on('tileloaderror', function(event) {
            me.renderStatusService.updateComplete(
              layer,
              wmsOnlineResource,
              true
            );
          });

          this.olMapObject.addLayerById(wmsTile, layer.id);
        }
      );
    }
  }


  /**
   * An injected function into Openlayers to proxy the URL *IF* the URL is too long
   */
  public imagePostFunction(image, src) {
    const img = image.getImage();
    const dataEntries = src.split('&');
    const url = this.env.portalBaseUrl + 'getWMSMapViaProxy.do?';
    const params = {};
    for (let i = 0; i < dataEntries.length; i++) {
      if (i === 0) {
        params['url'] = dataEntries[i];
      } else {
        if (dataEntries[i].toLowerCase().indexOf('layers') >= 0) {
          params['layer'] = decodeURIComponent(dataEntries[i].split('=')[1]);
        }
        if (dataEntries[i].toLowerCase().indexOf('bbox') >= 0) {
          params['bbox'] = decodeURIComponent(dataEntries[i].split('=')[1]);
        }
        if (dataEntries[i].toLowerCase().indexOf('sldurl') >= 0) {
          params['sldUrl'] = decodeURIComponent(dataEntries[i].split('=')[1]);
        }
        if (dataEntries[i].toLowerCase().indexOf('sld_body') >= 0) {
          const sldBodyBase64 = decodeURIComponent(
            dataEntries[i].split('=')[1]
          );
          params['sldBody'] = window.atob(sldBodyBase64);
        }
        if (dataEntries[i].toLowerCase().indexOf('version') >= 0) {
          params['version'] = decodeURIComponent(dataEntries[i].split('=')[1]);
        }
        if (
          dataEntries[i].toLowerCase().indexOf('crs') === 0 ||
          dataEntries[i].toLowerCase().indexOf('srs') === 0
        ) {
          params['crs'] = decodeURIComponent(dataEntries[i].split('=')[1]);
        }
        if (dataEntries[i].toLowerCase().indexOf('tiled') >= 0) {
          params['tiled'] = decodeURIComponent(dataEntries[i].split('=')[1]);
        }
      }
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.responseType = 'arraybuffer';
    xhr.onload = function(e) {
      if (xhr.status === 200) {
        const uInt8Array = new Uint8Array(xhr.response);
        let i = uInt8Array.length;
        const binaryString = new Array(i);
        while (i--) {
          binaryString[i] = String.fromCharCode(uInt8Array[i]);
        }
        const data = binaryString.join('');
        const type = xhr.getResponseHeader('content-type');
        if (type.indexOf('image') === 0) {
          img.src = 'data:' + type + ';base64,' + window.btoa(data);
        }
      }
    };
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send($.param(params));
  }
}
