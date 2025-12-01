import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'DOM BIM Platform API',
            version: '1.0.0',
            description: 'API documentation for the DOM BIM Platform, including authentication, file management, project management, and APS integration.',
            contact: {
                name: 'DOM Support',
                email: 'support@dom.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:8080/api',
                description: 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'dom-session'
                }
            }
        },
        security: [
            {
                cookieAuth: []
            }
        ]
    },
    apis: ['./src/routes/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
