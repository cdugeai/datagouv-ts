import { createReadStream, statSync } from 'fs';
//var FormData = require('form-data');
import FormData from 'form-data';
import axios from 'axios';
import { Spinner } from 'ora';
import { assert, log } from 'console';
const ora = require('ora')


export class Datagouv {
    static getDatasetMetadata(baseUrl: string, datasetId: string|undefined) {
        return axios({
            url: [baseUrl, 'datasets', datasetId].join('/'),
            method: "get"
        })
        .then((r: any) => r.data)
    }



    static createResourceRemote(baseUrl: string, datasetId: string, title:string, description:string, url:string, datagouv_apiKey: string) {

        const payload = {
                "description": description,
                "filetype": "remote",
                "format": "csv",
                "mime": "text/csv",
                "title": title,
                "type": "main",
                "url": url
        }

        return axios({
            url: [baseUrl, 'datasets', datasetId, 'resources'].join('/'),
            method: "post",
            headers: {
                'Content-Type': 'application/json',
                "X-API-KEY": datagouv_apiKey
            },
            data: JSON.stringify(payload)
        })
        .then((r: any) => r.data)

    }

    /**
     * Update a Datagouv resource
     * @param resource Resource to update 
     * @param payload Fields to update. Some of {description?, title?, url?}
     * @returns Datagouv response
     */
    static updateResource(resource: DatagouvResourceCustom, api_base_url:string, dataset_id:string, datagouv_apiKey: string, payload: {description?: string, title?: string, url?: string}): Promise<DatagouvResourceCustom>{

        return axios(
            {
                url: [api_base_url, "datasets", dataset_id, "resources", resource.id].join("/"),
                method: 'put',
                headers: {
                    'Content-Type': 'application/json',
                    "X-API-KEY": datagouv_apiKey!,
                },
                data: JSON.stringify(payload)
            })
            .then(r => r.data)
    }

    static updateResourceDescription(resource: DatagouvResourceCustom, api_base_url:string, dataset_id:string,description: string, datagouv_apiKey: string): Promise<DatagouvResourceCustom>{
        return this.updateResource(resource, api_base_url, dataset_id, datagouv_apiKey, {description});
    }





    static createResourceFromFile(filePath: string, datagouvBaseUrl: string, datasetId: string, datagouv_apiKey: string): Promise<DatagouvResourceCustom> {

        let log_:boolean = false ;

        if (log_) console.log('Creating resource for '+filePath);
        
        const fileStream = createReadStream(filePath);
        
        const form = new FormData();
        form.append('file', fileStream, { knownLength: statSync(filePath).size});

        return axios.post(
            [datagouvBaseUrl, 'datasets', datasetId, 'upload'].join("/"), 
            form,
            {
                headers: {
                    "X-API-KEY": datagouv_apiKey
                }
            }
            )
        .then((r: any) => {
            if (!r.data.success) {
                console.log("Resource creation failed for "+filePath);
                console.log(r.data);
                throw new Error("Resource creation failed")
            }
            if (log_) console.log("Resource created: "+r.data.title);
            return r.data;
        })
        //@ts-ignore
        .then((r:DatagouvResourceCustom) => ({
            created_at: r.created_at,
            description: r.description,
            format: r.format,
            id: r.id,
            last_modified: r.last_modified,
            latest: r.latest,
            title:r.title,
            url: r.url,
            rest: r
        }))
        // On renomme la resource avec le nom exact du fichier. Va pemettre de le retrouver lors des prochaines recherches.
        .then(resource_created => this.updateResource(resource_created, datagouvBaseUrl, datasetId, datagouv_apiKey, {title: filePath.split("/").pop()} ))
        .then(resource_updated => {
            if (log_) console.log("Resource created and renamed to "+resource_updated.title);
            return resource_updated
        })
    }


    /**
     * Delete datagouv resource
     * @param resource_id 
     * @returns 
     */
    static deleteResource(resource_id: string, datagouvBaseUrl: string, dataset_id: string, datagouv_apiKey: string){
        const log_:boolean = false;
        return axios(
            [datagouvBaseUrl, 'datasets', dataset_id, 'resources', resource_id].join("/"), 
            {
                headers: {
                    "X-API-KEY": datagouv_apiKey
                },
                method: 'delete'
            }
            )
        .then((r: any) => {
            
            if (r.status != 204) throw new Error("HTTP code not 204 after deletion")
            if (log_) console.log("Resource deletion success for "+resource_id);

            // Should be empty string if deletion succeded
            return r.data;
        })
        .catch(r => {
            console.log("Resource deletion failed for "+resource_id+" : "+JSON.stringify({status: r.response.status, message: r.response.data.message}));
            throw new Error("Resource deletion failed");
        })
    }

    static test(resource_id: string, datagouvBaseUrl: string, dataset_id: string, datagouv_apiKey: string) {
        return this.deleteResource(resource_id, datagouvBaseUrl, dataset_id, datagouv_apiKey);
    }

    static sayHello() {
        console.log("hello 77");
        
    }

}

export type DatagouvResourceCustom = {
    id: string,
    created_at: string,
    last_modified: string,
    title: string,
    latest: string,
    url: string,
    description: string,
    format: string
}