import "./style.css"
import {NetworkGraph} from './NetworkGraph';
import {GraphQlService} from "./gql/GraphQlService.ts";
import {AuthService, OdmdUserInfo} from "./auth/AuthService.ts";
import {BuildNode} from "./models/nodes/BuildNode.ts";
import {ConfigService} from "./OdmdConfig.ts";

window.location.search.startsWith('?region=')
const regFromUrl = window.location.search.substring('?region='.length)

const supportedRegions = ['us-east-1', 'us-west-1'];
const region = supportedRegions.includes(regFromUrl) ? regFromUrl : 'us-west-1'
const regionToBuildIds = {
    "us-east-1": [
        'OdmdBuildUserAuth',
        'LlmChatLambdaS3',
        'VisLlmOdmdData-shop-foundation',
        'FapiErc20Build',
    ],
    'us-west-1': [
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
    buildPanel.style.position = 'fixed';
    buildPanel.style.top = '20px';
    buildPanel.style.left = '20px';
    buildPanel.style.backgroundColor = 'white';
    buildPanel.style.borderRadius = '4px';
    buildPanel.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    buildPanel.style.zIndex = '1001';
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
        content.style.maxHeight = '5000px';
    });

    buildPanel.addEventListener('mouseleave', () => {
        content.style.maxHeight = '0';
    });

    document.querySelector('#app')?.appendChild(buildPanel);
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

    const allBuildEntities = config.gqlConfig.visData
    buildSelectionPanel(allBuildEntities.map(i => i.id));

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
                Sign in with Google
            </button>
        `;

        await network.renderBuilds(allBuildEntities)
    }

    // Add event listeners for auth buttons
    document.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.login-button')) {
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
