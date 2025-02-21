import gql from 'graphql-tag';

// Document Nodes
export const GET_ENTITY_QUERY = gql`
    query GetEntity($id: ID!) {
        getEntity(id: $id) {
            id
            content
        }
    }
`;

export const LIST_ENTITIES_QUERY = gql`
    query ListEntitiesWithFilter(
        $filter: String
        $pagination: PaginationInput
    ) {
        listEntitiesWithFilter(
            filter: $filter
            pagination: $pagination
        ) { ## EntityConnection
            items { ## Endtity
                id
                content
            }
            nextToken
        }
    }
`;

export const CREATE_ENTITY_MUTATION = gql`
    mutation CreateEntity($input: CreateEntityInput!) {
        createEntity(input: $input) {
            id
            content
        }
    }
`;

export const UPDATE_ENTITY_MUTATION = gql`
    mutation UpdateEntity($input: UpdateEntityInput!) {
        updateEntity(input: $input) {
            id
            content
        }
    }
`;


export const OnEntityChangedById = gql`
    subscription OnEntityChangedById($id: ID!) {
        onEntityChanged(id: $id) {
            id
            content
        }
    }
`;
