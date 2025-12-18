const ForgeApis = require('forge-apis');
console.log('ForgeApis keys:', Object.keys(ForgeApis));

const { HubsApi } = ForgeApis;
console.log('HubsApi:', HubsApi);

if (HubsApi) {
    const instance = new HubsApi();
    console.log('HubsApi instance keys:', Object.keys(instance));
    console.log('HubsApi instance proto keys:', Object.keys(Object.getPrototypeOf(instance)));

    if (instance.getHubs) {
        console.log('instance.getHubs length:', instance.getHubs.length);
        console.log('instance.getHubs source:', instance.getHubs.toString().split('\n')[0]);
    }
}
