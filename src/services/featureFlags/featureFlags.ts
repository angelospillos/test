type Project = {
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    featureFlags: ProjectFeatureFlags;
};

type ProjectFeatureFlags = {
    [featureName: string]: boolean;
};


import { selectCurrentProject } from '~/modules/project';
import storeRegistry from '~/modules/storeRegistry';

import BaseService from '../baseService';

class FeatureFlags extends BaseService {
    constructor() {
        super('FeatureFlags');
    }

    private async getFeatures(): Promise<ProjectFeatureFlags> {
        const state = await storeRegistry.getState();
        const project = selectCurrentProject(state) as Project;
        return project.featureFlags;
    }

    isEnabled = async (feature: keyof ProjectFeatureFlags) => {
        try {
            const flags = await this.getFeatures();
            return flags[feature];
        } catch (error) {
            this.logError(`Error while checking if feature "${feature}" is enabled`, error);
            return false;
        }
    };
}

export default new FeatureFlags();
