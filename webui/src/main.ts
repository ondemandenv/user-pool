import "./style.css"
import {NetworkGraph} from './NetworkGraph';
import {GraphQlService} from "./gql/GraphQlService.ts";
import {AuthService, OdmdUserInfo} from "./auth/AuthService.ts";
import {BuildNode} from "./models/nodes/BuildNode.ts";
import {ConfigService} from "./OdmdConfig.ts";

window.location.search.startsWith('?region=')
const regFromUrl = window.location.search.substring('?region='.length)

const supportedRegions = ['us-east-1', 'us-west-1'];
const region = supportedRegions.includes(regFromUrl) ? regFromUrl : supportedRegions[0];
GraphQlService.region = region
const regionToBuildIds = {
    "us-east-1": [
        'OdmdBuildUserAuth',
        'LlmChatLambdaS3',
        'VisLlmOdmdData-shop-foundation',
        'FapiErc20Build',
    ],
    'us-west-1': [
        'networking',
        'eks-cluster-sbx',
        'sampleSpringOpenAPI3img',
        'sampleSpringOpenAPI3cdk',
        'coffee-shop-foundation',
        'coffeeShopOrderProcessor',
        'coffeeShopOrderManage',
    ]
} as { [key: string]: string[] }


const cachedSelected = localStorage.getItem('_selectedBuildIds');//, JSON.stringify(Array.from(_selectedBuildIds)))
const _selectedBuildIds = new Set<string>(cachedSelected ? JSON.parse(cachedSelected) : regionToBuildIds[region]!)

function buildSelectionPanel(allBuildIds: string[]) {
    // Create build selection panel
    const buildPanel = document.createElement('div');
    buildPanel.id = 'build-panel';
    buildPanel.style.backgroundColor = 'white';
    buildPanel.style.borderRadius = '4px';
    buildPanel.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    buildPanel.style.transition = 'all 0.3s ease';
    buildPanel.style.padding = '8px';
    buildPanel.style.cursor = 'pointer';

    const header = document.createElement('div');
    header.textContent = 'Builds';
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '8px';
    buildPanel.appendChild(header);

    const content = document.createElement('div');
    content.style.maxHeight = '0';
    content.style.overflow = 'hidden';
    content.style.transition = 'max-height 0.3s ease';

    if (_selectedBuildIds.size == 0) {
        allBuildIds.forEach((id: string) => {
            _selectedBuildIds.add(id)
        })
    }

    allBuildIds.forEach(buildId => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '8px';
        label.style.marginBottom = '4px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = _selectedBuildIds.has(buildId);
        checkbox.addEventListener('change', () => {
            checkbox.checked ? _selectedBuildIds.add(buildId) : _selectedBuildIds.delete(buildId);
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(buildId));
        content.appendChild(label);
    });

    const submitButton = document.createElement('button');
    submitButton.id = 'buildId-submit';
    submitButton.textContent = 'Apply';
    submitButton.style.marginTop = '8px';
    submitButton.style.padding = '4px 8px';
    submitButton.style.backgroundColor = '#4285f4';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '4px';
    submitButton.style.cursor = 'pointer';
    content.appendChild(submitButton);
    buildPanel.appendChild(content);

    buildPanel.addEventListener('mouseenter', () => {
        content.style.maxHeight = '5000px'; // Consider a more reasonable max-height?
    });

    buildPanel.addEventListener('mouseleave', () => {
        content.style.maxHeight = '0';
    });

    return buildPanel; // Return the created element
}

async function main() {

    const config = await ConfigService.getInstance(region)

    const auth = new AuthService(config.authConfig);

    // Handle OAuth callback
    const url = new URL(window.location.href);
    if (url.search.startsWith('?callback')) {
        try {
            const userInfo = await auth.handleCallback(url.searchParams);
            window.location.href = '/';
            return; // Exit early since we're redirecting
        } catch (error) {
            console.error('Auth callback error:', error);
            window.location.href = '/';
            return; // Exit early since we're redirecting
        }
    }

    // Initialize the app container first
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
        <div id="network-container"></div>
        <div id="auth-container"></div>
    `;

    // Create a container for controls (region dropdown + build panel)
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'controls-container';
    controlsContainer.style.position = 'fixed';
    controlsContainer.style.top = '20px';
    controlsContainer.style.left = '20px';
    controlsContainer.style.zIndex = '1001';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.alignItems = 'flex-start'; // Align items to the top
    controlsContainer.style.gap = '10px'; // Space between dropdown and build panel

    // Create region dropdown
    const regionSelect = document.createElement('select');
    regionSelect.id = 'region-select';
    regionSelect.style.padding = '4px 8px'; // Slightly adjust padding for standalone look
    regionSelect.style.marginTop = '8px'; // Align roughly with build panel padding
    regionSelect.style.borderRadius = '4px';
    regionSelect.style.border = '1px solid #ccc'; // Add border for clarity

    supportedRegions.forEach(r => {
        const option = document.createElement('option');
        option.value = r;
        option.textContent = r;
        if (r === region) {
            option.selected = true;
        }
        regionSelect.appendChild(option);
    });

    regionSelect.addEventListener('change', (event) => {
        const selectedRegion = (event.target as HTMLSelectElement).value;
        window.location.search = `?region=${selectedRegion}`;
    });

    controlsContainer.appendChild(regionSelect); // Add dropdown to the controls container

    const allBuildEntities = config.gqlConfig.visData
    const buildPanel = buildSelectionPanel(allBuildEntities.map(i => i.id));
    controlsContainer.appendChild(buildPanel);
    controlsContainer.appendChild(regionSelect);

    document.querySelector('#app')?.appendChild(controlsContainer);

    // Handle authentication UI
    const userInfo = localStorage.getItem('user_info');
    const authContainer = document.querySelector('#auth-container');

    // Initialize network graph
    const network = new NetworkGraph('network-container');
    if (userInfo) {
        const user = JSON.parse(userInfo) as OdmdUserInfo

        if (!auth.credentials) {
            await auth.refreshCredentials()
        }

        new GraphQlService(auth.credentials!, config.gqlConfig);

        authContainer!.innerHTML = `
            <div class="user-info">
                ${user.email}
                [<span>${user.cogGroups?.join()}</span>]
                <button id="logout-button">Logout</button>
            </div>
        `;

    } else {
        authContainer!.innerHTML = `
            <button class="login-button">
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google">
                Sign in with Google to connect to data/appsync service
            </button>
        `;

        await network.renderBuilds(allBuildEntities)
    }

    // Add event listeners for auth buttons
    document.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const loginButton = target.closest('.login-button') as HTMLButtonElement | null;
        if (loginButton) {
            loginButton.disabled = true;
            auth.initiateGoogleLogin();
        } else if (target.closest('#logout-button')) {
            auth.logout();
        } else if (target.closest('#buildId-submit')) {
            const buildIdsArr = Array.from(_selectedBuildIds);
            localStorage.setItem('_selectedBuildIds', JSON.stringify(buildIdsArr))

            try {
                await network.renderBuilds(await BuildNode.QueryByBuildIds(buildIdsArr))//it's will initial data
            } catch (e) {
                //not login
                await network.renderBuilds(allBuildEntities.filter(b => _selectedBuildIds.has(b.id)))
            }

        }
    });
    try {
        const buildIdsArr = Array.from(_selectedBuildIds);
        await network.renderBuilds(await BuildNode.QueryByBuildIds(buildIdsArr))//it's will initial data
    } catch (e) {
        //not login
        await network.renderBuilds(allBuildEntities.filter(b => _selectedBuildIds.has(b.id)))
    }

}

// Handle any errors in main
main().catch(error => {
    console.error('Application error:', error);
});
