document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-user-input');
        const user = input.value.trim();
        if (user) {
            await addItem('/api/users', { user });
            input.value = '';
        }
    });

    document.getElementById('add-activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-activity-input');
        const activity = input.value.trim();
        if (activity) {
            await addItem('/api/activities', { activity });
            input.value = '';
        }
    });
});

async function fetchData() {
    try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        renderList('users-list', data.users || []);
        renderList('activities-list', data.activities || []);
    } catch (err) {
        console.error('Failed to fetch data', err);
    }
}

function renderList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = '<div class="item-card" style="opacity: 0.5; text-align: center;">No items found</div>';
        return;
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.textContent = item;
        // Stagger animation delay
        div.style.animation = `fadeInUp 0.3s ease-out ${index * 0.05}s forwards`;
        div.style.opacity = '0';
        div.style.transform = 'translateY(10px)';
        container.appendChild(div);
    });
}

async function addItem(endpoint, payload) {
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Error posting item');
        await fetchData(); // Refresh the lists to show the new item
    } catch (err) {
        console.error(`Failed to post to ${endpoint}`, err);
    }
}
