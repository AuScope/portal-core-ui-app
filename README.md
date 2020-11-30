# portal-core-ui
Shared portal UI components written in Angular 9. This project is a workspace for creating a portal-core-ui library that can be deployed and imported into portal projects.

## Development

### Install dependencies

`npm install`
or
`yarn install`


### Build the library

`ng build portal-core-ui`


### Create a link to the library
```
cd dist\portal-core-ui
npm link
```

In the project that uses the library (e.g. AuScope-Portal-UI or ngvl):

`npm link portal-core-ui`

This creates a symbolic link for node_modules/portal-core-ui that links to the distribution folder of the library project.

Don't forget to unlink when you're no lomger interested in using the development version of the library:

`npm unlink portal-core-ui`

### Adding a new Component (or Service, Model etc.)

Add the component to the relevant directory under portal-core-ui/src/lib.
Add the Component to the library export file ./portal-core-ui/public-api.ts, e.g:

`export { MyComponent } from './lib/mycompdir/my.component';`

Note that project imports will need to be modified to remove the path components from the import, e.g:

`import { UtilitiesService } from 'portal-core-ui/utility/utilities.service';`

Will become...

`import { UtilitiesService } from 'portal-core-ui';`

With some modifications to the public-api.ts we can re-include the paths if necessary.

### Packaging asset files

Add the files to the "assets" list in the file portal-core-ui/ng-package.json, e.g:
```
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/portal-core-ui",
  "assets": [
    "./src/lib/widget/chart/rickshaw/rickshaw.service.scss",
	"./src/lib/mycompdir/my.component.scss"
  ],
  "lib": {
    "entryFile": "src/public-api.ts"
  }
}
```
Note that for development that this will place the asset under:

`./node_modules/portal-core-ui/src/lib/<directory>`

Project paths that reference this asset will need to be updated to match.

Note: I've yet to test where a deployed package puts these files, will update this file once we have a deployed version.


### Deploying the package

Coming soon...
