import { createReadStream, statSync } from 'fs';
import FormData from 'form-data';
import axios from 'axios';


export class Datagouv {

    /**
     * Get metadata of given dataset
     * @param baseUrl Base url of datagouv instance
     * @param datasetId Id of dataset to inspect
     * @returns Metdata of dataset as object
     */
    static getDatasetMetadata(baseUrl: string, datasetId: string|undefined) {
        return axios({
            url: [baseUrl, 'datasets', datasetId].join('/'),
            method: "get"
        })
        .then((r: any) => r.data)
    }


    /**
     * Create resource remote. The resource will be linked to a file hosted publicly.
     * @param baseUrl Base url of datagouv instance
     * @param datasetId Id of dataset to inspect
     * @param title Title of the new resource to create
     * @param description Description of the new resource to create
     * @param url Url of the existing file. This url should be accessible without authentication
     * @param datagouv_apiKey API key to publish data on the datagouv instance
     * @returns Created resource as Promise<DatagouvResourceCustom>
     */
    static createResourceRemote(baseUrl: string, datasetId: string, title:string, description:string, url:string, datagouv_apiKey: string): Promise<DatagouvResourceCustom> {

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
     * @returns Updated resource as Promise<DatagouvResourceCustom>
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




    /**
     * Create resource
     * @param filePath Local path of the file to upload
     * @param datagouvBaseUrl Base url of datagouv instance
     * @param datasetId Id of dataset to inspect
     * @param datagouv_apiKey API key to publish data on the datagouv instance
     * @returns Created resource as Promise<DatagouvResourceCustom>
     */
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
     * @param resource_id Id of resource to delete
     * @returns Empty string if deletion is successful
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


    /**
     * Get all matching resource of dataset whose title match param "pattern"
     * @param dataset_id ID of dataset
     * @param api_base_url API base url
     * @param pattern Pattern of "title" of resources to match before deletion
     * @param verbose Verbose mode
     * @returns Array of DatagouvResourceCustom whose "title" match "pattern"
     */
    static async getMatchingResources(dataset_id:string, api_base_url: string, pattern: string, verbose: boolean): Promise<DatagouvResourceCustom[]>{
        let dataset = await this.getDatasetMetadata(api_base_url, dataset_id);

        let matchingResources: DatagouvResourceCustom[] = dataset.resources
            .filter((resource: DatagouvResourceCustom) => RegExp(pattern).test(resource.title));

        if (verbose) console.log("[getMatchingResources] Matching resources for "+dataset_id+ " and "+pattern+" "+JSON.stringify(matchingResources.map((resource: DatagouvResourceCustom) => ({id: resource.id, title: resource.title}))));

        return matchingResources;
    }


    /**
     * Delete all resource whose title matche pattern in a dataset
     * @param dataset_id ID of the dataset
     * @param api_base_url Base URL od datagouv
     * @param api_key API key
     * @param pattern Pattern of "title" of resources to match before deletion
     * @param confirmDelete Boolean to tell if should delete. Useful for dry runs
     * @param verbose Verbose mode
     * @returns Resources that were deleted, and do not exist anymore on datagouv
     */
    static async deleteResourceDatasetPattern(dataset_id:string, api_base_url: string, api_key:string, pattern: string, confirmDelete: boolean, verbose: boolean): Promise<DatagouvResourceCustom[]> {
        
        let matchingResources: DatagouvResourceCustom[] = await this.getMatchingResources(dataset_id, api_base_url, pattern, verbose);


        for (let resource of matchingResources) {
            if(confirmDelete) await this.deleteResource(resource.id, api_base_url, dataset_id, api_key)
            if (verbose) console.log("[deleteResourceDatasetPattern] Resource deleted : "+resource.title);
        }

        return matchingResources;
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