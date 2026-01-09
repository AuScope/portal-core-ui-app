
import { throwError as observableThrowError, Observable } from 'rxjs';
import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';

import { OnlineResourceModel } from '../../model/data/onlineresource.model';
import { LayerModel } from '../../model/data/layer.model';
import { LayerHandlerService } from '../cswrecords/layer-handler.service';
import { MapsManagerService } from '@auscope/angular-cesium';
import { Constants, ResourceType } from '../../utility/constants.service';
import { RenderStatusService } from '../cesium-map/renderstatus/render-status.service';
import { KMLDocService } from './kml.service';
import { UtilitiesService } from '../../utility/utilities.service';
import { Color, ColorMaterialProperty, Rectangle } from 'cesium';

// NB: Cannot use "import { XXX, YYY, ZZZ, Color } from 'cesium';" - it prevents initialising ContextLimits.js properly
// which causes a 'DeveloperError' when trying to draw the KML 
declare var Cesium;

/**
 * Use Cesium to add layer to map. This service class adds KML layer to the map
 */
@Injectable()
export class CsKMLService {

  // List of KML layers that have been cancelled
  private cancelledLayers: Array<string> = [];
  // Number of KML resources added for a given layer
  private numberOfResourcesAdded: Map<string, number> = new Map<string, number>();

  private overlayDoc: Node; // used to make a temporary copy of <GroundOverlay> for restoring to layer.kmlDoc 

  constructor(private layerHandlerService: LayerHandlerService,
    private http: HttpClient,
    private renderStatusService: RenderStatusService,
    private mapsManagerService: MapsManagerService,
    private kmlService: KMLDocService,
    @Inject('env') private env) {
  }

  /**
   * Downloads KML, cleans it
   *
   * @param kmlResource KML resource to be fetched
   * @returns cleaned KML text
   */
  private getKMLFeature(url: string): Observable<any> {
    return this.http.get(url, { responseType: 'text' }).pipe(map((kmlTxt: string) => {
      // Remove unwanted characters and inject proxy for embedded URLs
      return this.kmlService.cleanKML(kmlTxt);
    }), catchError(
      (error: HttpResponse<any>) => {
        return observableThrowError(error);
      }
    ));
  }


  /**
   * gets the icon from the KML if the url is http...
   *
   * @param kmlResource KML resource to be fetched
   * @returns icon object (url and rectangle coords)
   */

  private getIcon(kmlDoc: Document): any {
    let result = {};
    let gos = kmlDoc.querySelectorAll("GroundOverlay");
    if (gos) {
      gos.forEach(go => {
        let iconEntity = go.querySelector("Icon");
        let iconURL = iconEntity.querySelector('href').textContent;
        if (iconURL.toLowerCase().startsWith("http")) {
          let rectEntity = go.querySelector("LatLonBox");
          let north = rectEntity.querySelector('north').textContent;
          let south = rectEntity.querySelector('south').textContent;
          let east = rectEntity.querySelector('east').textContent;
          let west = rectEntity.querySelector('west').textContent;
          result = { url: iconURL, rectangle: { north: north, south: south, east: east, west: west } };
        }
      });
    }
    return result;
  }


  /**
   * removes the <GroundOverlay> element from the kml document
   *
   * @param kmlResource KML resource to be fetched
   * @returns updated kml document and saves the removed nodes to overlayDoc
   */

  private removeOverlay(kmlDoc: Document): Document {
    let gos = kmlDoc.querySelectorAll("GroundOverlay");
    if (gos) {
      gos.forEach(go => {
        // backup <GroundOverlay> and restore after the kml source is loaded 
        this.overlayDoc = go.cloneNode(true);
        go.remove();
      });
    }
    return kmlDoc;
  }


  /**
   * Add the KML layer
   * @param layer the KML layer to add to the map
   * @param param parameters for the KML layer
   */
  public addLayer(layer: LayerModel, param?: any): void {
    // Remove from cancelled layer list (if present)
    this.cancelledLayers = this.cancelledLayers.filter(l => l !== layer.id);

    let kmlOnlineResources: OnlineResourceModel[];

    if (UtilitiesService.layerContainsResourceType(layer, ResourceType.KML)) {
      kmlOnlineResources = this.layerHandlerService.getOnlineResources(layer, ResourceType.KML);
    }
    if (UtilitiesService.layerContainsResourceType(layer, ResourceType.KMZ)) {
      kmlOnlineResources = this.layerHandlerService.getOnlineResources(layer, ResourceType.KMZ);
    }
    const me = this;

    // Get CesiumJS viewer
    const viewer = this.getViewer();
    const options = {
      camera: viewer.scene.camera,
      canvas: viewer.scene.canvas,
    };

    for (const onlineResource of kmlOnlineResources) {
      // Tell UI that we're about to add a resource to map
      this.renderStatusService.addResource(layer, onlineResource);

      // Create data source
      const source = new Cesium.KmlDataSource(options);
      // Add an event to tell us when loading is finished
      source.loadingEvent.addEventListener((evt, isLoading: boolean) => {
        if (!isLoading) {
          // Tell UI that we have completed updating the map
          me.renderStatusService.updateComplete(layer, onlineResource);
        }
      });

      // If KML is sourced from a file loaded from a browser, else URL
      // note: KML and KMZ, loaded either from a local file or url now have
      // a layer.kmlDoc entry - so some of the following code is redundant
      if (layer.kmlDoc) {
        var iconObject = this.getIcon(layer.kmlDoc);
        // TODO: remove <GroundOverlay> from the kml before the sourse is loaded!!
        //       elements still to handle: name, description, rotation
        let overlayRect;
        let kmlDoc = layer.kmlDoc;
        if (iconObject.rectangle) {
          overlayRect = Rectangle.fromDegrees(iconObject.rectangle.west, iconObject.rectangle.south, iconObject.rectangle.east, iconObject.rectangle.north);
          // remove <GroundOverlay> from KML
          kmlDoc = this.removeOverlay(layer.kmlDoc);
        }
        source.load(kmlDoc).then(dataSource => {
          if (this.cancelledLayers.indexOf(layer.id) === -1) {
            let overlayProvider;
            viewer.dataSources.add(dataSource).then(async dataSrc => {
              layer.csLayers.push(dataSrc);

              if (!iconObject.url) {
                this.incrementLayersAdded(layer, 1);
              } else {
                this.incrementLayersAdded(layer, 2);

                const layers = viewer.scene.imageryLayers;
                // Use the proxy
                const proxyUrl = this.env.portalBaseUrl + Constants.PROXY_API + "?usewhitelist=false&url=" + iconObject.url;
                overlayProvider = new Cesium.SingleTileImageryProvider({
                  url: proxyUrl,
                  layers: layer.name,
                  rectangle: overlayRect,
                  credit: "credit for the data source",
                });

                setTimeout(() => {
                  viewer.camera.flyTo({ destination: overlayRect });
                }, 100);

                setTimeout(() => {
                  if (overlayProvider.ready) {
                    try {
                      // restore kmlDoc, i.e. add back <GroundOverlay>
                      layer.kmlDoc.querySelector("Folder").appendChild(this.overlayDoc);
                      var newLayer = viewer.imageryLayers.addImageryProvider(overlayProvider);
                      layer.csLayers.push(newLayer);
                    } catch (error) {
                      // Handle error
                      console.log(`(timeout)There was an error while creating the imagery layer. ${error}`);
                    }
                  }
                }, 2000);

              }

            });
          }
        });
      } else {
        if (!this.numberOfResourcesAdded.get(layer.id)) {
          this.numberOfResourcesAdded.set(layer.id, 0);
        }

        if (UtilitiesService.layerContainsResourceType(layer, ResourceType.KMZ)) {
          // add KMZ to map
          source.load(onlineResource.url).then(dataSource => {
            viewer.dataSources.add(dataSource).then(dataSrc => {
              layer.csLayers.push(dataSrc);
              this.incrementLayersAdded(layer, kmlOnlineResources.length);
            });
          });

        } else {
          // Add KML to map
          this.getKMLFeature(onlineResource.url).subscribe(response => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(response, 'text/xml');
            source.load(doc).then(dataSource => {
              if (this.cancelledLayers.indexOf(layer.id) === -1) {
                viewer.dataSources.add(dataSource).then(dataSrc => {
                  layer.csLayers.push(dataSrc);
                  this.incrementLayersAdded(layer, kmlOnlineResources.length);
                });
              }
            });
          }, (err) => {
            alert('Unable to load KML: ' + err.message);
            console.error('Unable to load KML: ', err);
            // Tell UI that we have completed updating the map & there was an error
            this.renderStatusService.updateComplete(layer, onlineResource, true);
            this.incrementLayersAdded(layer, kmlOnlineResources.length);
          });
        }
      }
    }
  }

  /**
   * Increment the number of layers added for a given LayerModel, and clear the layer from the
   * cancelled layer list if all layers have been added
   * @param layer the LayerModel
   * @param totalLayers total number of layers for LayerModel
   */
  private incrementLayersAdded(layer: LayerModel, totalLayers: number) {
    this.numberOfResourcesAdded.set(layer.id, this.numberOfResourcesAdded.get(layer.id) + 1);
    if (this.numberOfResourcesAdded.get(layer.id) === totalLayers) {
      this.cancelledLayers = this.cancelledLayers.filter(l => l !== layer.id);
    }
  }

  /**
   * Request cancellation of layer if it's still being added
   * @param layerId ID of layer
   */
  public cancelLayerAdded(layerId: string) {
    if (this.cancelledLayers.indexOf(layerId) === -1) {
      this.cancelledLayers.push(layerId);
    }
  }

  /**
   * Removes KML layer from the map
   * @method rmLayer
   * @param layer the KML layer to remove from the map.
   */
  public rmLayer(layer: LayerModel): void {
    // Request cancellation of layer if it's still being added
    this.cancelLayerAdded(layer.id);

    const viewer = this.getViewer();
    for (const viewerObject of layer.csLayers) {
      if (viewerObject.constructor && viewerObject.constructor.name === "KmlDataSource") { viewer.dataSources.remove(viewerObject); }
      if (viewerObject.constructor && viewerObject.constructor.name === "ImageryLayer") {
        const layers = viewer.scene.imageryLayers;
        viewer.imageryLayers.remove(viewerObject);
      }
    }
    layer.csLayers = [];
    this.renderStatusService.resetLayer(layer.id);
  }

  /**
   * Fetches Cesium 'Viewer'
   */
  private getViewer() {
    return this.mapsManagerService.getMap().getCesiumViewer();
  }

}
