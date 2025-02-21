export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: { input: string; output: string; }
    String: { input: string; output: string; }
    Boolean: { input: boolean; output: boolean; }
    Int: { input: number; output: number; }
    Float: { input: number; output: number; }
};

export type Consuming = {
    __typename?: 'Consuming';
    content?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    productId: Scalars['ID']['output'];
};

export type ConsumingConnection = {
    __typename?: 'ConsumingConnection';
    items: Array<Consuming>;
    nextToken?: Maybe<Scalars['String']['output']>;
};

export type CreateConsumingInput = {
    content?: InputMaybe<Scalars['String']['input']>;
    id: Scalars['ID']['input'];
    productId: Scalars['ID']['input'];
};

export type CreateEntityInput = {
    content?: InputMaybe<Scalars['String']['input']>;
    id?: InputMaybe<Scalars['ID']['input']>;
};

export type Entity = {
    __typename?: 'Entity';
    content?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
};

export type EntityConnection = {
    __typename?: 'EntityConnection';
    items: Array<Entity>;
    nextToken?: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
    __typename?: 'Mutation';
    createConsuming: Consuming;
    createEntity: Entity;
    deleteConsuming: Consuming;
    deleteEntity: Entity;
    updateEntity: Entity;
};


export type MutationCreateConsumingArgs = {
    input: CreateConsumingInput;
};


export type MutationCreateEntityArgs = {
    input: CreateEntityInput;
};


export type MutationDeleteConsumingArgs = {
    id: Scalars['ID']['input'];
};


export type MutationDeleteEntityArgs = {
    id: Scalars['ID']['input'];
};


export type MutationUpdateEntityArgs = {
    input: UpdateEntityInput;
};

export type PaginationInput = {
    limit: Scalars['Int']['input'];
    nextToken?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
    __typename?: 'Query';
    getEntity?: Maybe<Entity>;
    listEntitiesWithFilter: EntityConnection;
};


export type QueryGetEntityArgs = {
    id: Scalars['ID']['input'];
};


export type QueryListEntitiesWithFilterArgs = {
    filter?: InputMaybe<Scalars['String']['input']>;
    pagination?: InputMaybe<PaginationInput>;
};

export type Subscription = {
    __typename?: 'Subscription';
    onConsumingChanged?: Maybe<Consuming>;
    onEntityChanged?: Maybe<Entity>;
};


export type SubscriptionOnConsumingChangedArgs = {
    enverId: Scalars['ID']['input'];
};


export type SubscriptionOnEntityChangedArgs = {
    id?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateEntityInput = {
    content?: InputMaybe<Scalars['String']['input']>;
    id: Scalars['ID']['input'];
};
