import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RenderObject } from '../../src/components/RenderObject.js';
import { listContextKinds } from '../../src/contexts/index.js';
import { UserObject } from '../../src/objects/user/object.js';
import { SubscriptionObject } from '../../src/objects/subscription/object.js';
import userActiveFixture from '../../src/fixtures/user/active.json';
import subscriptionActiveFixture from '../../src/fixtures/subscription/active.json';
import subscriptionPastDueFixture from '../../src/fixtures/subscription/past_due.json';
import subscriptionCancelFixture from '../../src/fixtures/subscription/active_cancel_at_period_end.json';
const CONTEXTS = listContextKinds();
const userActive = userActiveFixture;
const subscriptionScenarios = [
    {
        title: 'Active',
        data: subscriptionActiveFixture,
    },
    {
        title: 'Past Due',
        data: subscriptionPastDueFixture,
    },
    {
        title: 'Active · Cancel At Period End',
        data: subscriptionCancelFixture,
    },
];
export function Sprint03Demo() {
    return (_jsxs("div", { className: "sprint03-demo grid gap-8 p-6", style: {
            display: 'grid',
            gap: '2rem',
            padding: '1.5rem',
        }, children: [_jsxs("header", { children: [_jsx("h1", { children: "Sprint 03 \u2014 Trait Composition Demo" }), _jsx("p", { children: "User and Subscription objects rendered across every OODS context with debug reports enabled." })] }), _jsxs("section", { "aria-labelledby": "user-contexts", children: [_jsx("h2", { id: "user-contexts", children: "User Object \u2014 Context Sweep" }), _jsx("div", { className: "grid gap-6", style: {
                            display: 'grid',
                            gap: '1.5rem',
                        }, children: CONTEXTS.map((context) => (_jsxs("article", { "aria-label": `User context: ${context}`, style: {
                                display: 'grid',
                                gap: '1rem',
                            }, children: [_jsx("h3", { style: { textTransform: 'capitalize' }, children: context }), _jsx(RenderObject, { object: UserObject, context: context, data: userActive, debug: true })] }, `user-${context}`))) })] }), _jsxs("section", { "aria-labelledby": "subscription-contexts", children: [_jsx("h2", { id: "subscription-contexts", children: "Subscription \u2014 Detail States" }), _jsx("div", { className: "grid gap-6", style: {
                            display: 'grid',
                            gap: '1.5rem',
                        }, children: subscriptionScenarios.map(({ title, data }) => (_jsxs("article", { "aria-label": `Subscription scenario: ${title}`, style: {
                                display: 'grid',
                                gap: '1rem',
                            }, children: [_jsx("h3", { children: title }), _jsx(RenderObject, { object: SubscriptionObject, context: "detail", data: data, debug: true })] }, `subscription-${title}`))) })] })] }));
}
export default Sprint03Demo;
//# sourceMappingURL=sprint03.js.map