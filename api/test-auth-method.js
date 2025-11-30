const { AuthClientThreeLegged } = require('forge-apis');

try {
    const client = new AuthClientThreeLegged('id', 'secret', 'callback', ['data:read']);
    console.log('Methods on instance:');
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client)));

    if (typeof client.generateAuthUrl === 'function') {
        console.log('FOUND: generateAuthUrl');
    }
    if (typeof client.getAuthorizeURL === 'function') {
        console.log('FOUND: getAuthorizeURL');
    }
} catch (e) {
    console.error(e);
}
