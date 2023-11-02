export const STORE_TYPES = {
    BACKGROUND: 'background',
    PROXY: 'proxy',
    CONTENT: 'content',
  };
  
  class StoreRegistry {
    store = {};
  
    isContentContext = false;
  
    set(namespace, newStore) {
      this.store[namespace] = newStore;
    }
  
    get(namespace) {
      return this.store[namespace] || {};
    }
  
    getProxyState() {
      return this.get(STORE_TYPES.PROXY).state;
    }
  
    getContentState() {
      return this.get(STORE_TYPES.PROXY).getState();
    }
  
    dispatchInContent(...args) {
      return this.get(STORE_TYPES.CONTENT)?.dispatch(...args);
    }
  
    getBackgroundState() {
      return this.get(STORE_TYPES.BACKGROUND).getState();
    }
  
    dispatchInBackground(...args) {
      return this.get(STORE_TYPES.BACKGROUND).dispatch(...args);
    }
  
    async getState() {
      if (this.isContentContext) {
        await this.get(STORE_TYPES.PROXY).readyPromise;
        return this.getProxyState();
      }
  
      return this.getBackgroundState();
    }
  }
  
  export default new StoreRegistry();
  