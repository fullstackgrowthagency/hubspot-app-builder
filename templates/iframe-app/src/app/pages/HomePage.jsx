import { useEffect } from 'react';
import { Button, EmptyState, Text, useExtensionActions } from '@hubspot/ui-extensions';
import { PageBreadcrumbs, PageTitle } from '@hubspot/ui-extensions/pages';

// HubSpot's UI Extensions runtime does not support an inline <iframe>; the only
// supported mechanism is openIframeModal (a modal dialog). This page opens the
// target URL in that modal automatically on load, and offers a button to reopen
// it if the visitor closes the modal.
//
// openIframeModal's height/width are required fixed pixel numbers — HubSpot's
// API has no percentage or fullscreen option — so the modal is sized from the
// viewer's actual browser viewport at open time instead of a hardcoded value,
// leaving a small margin for the modal's own chrome rather than requesting the
// exact viewport size.
function modalSize() {
  if (typeof window === 'undefined') return { height: 900, width: 1400 };
  return {
    height: Math.floor(window.innerHeight * 0.9),
    width: Math.floor(window.innerWidth * 0.95)
  };
}

export const HomePage = () => {
  const { openIframeModal } = useExtensionActions();

  const openTarget = () => {
    openIframeModal({
      uri: '{{targetUrl}}',
      ...modalSize(),
      title: '{{navLabel}}',
      flush: true
    });
  };

  useEffect(() => {
    openTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageBreadcrumbs>
        <PageBreadcrumbs.Current>{{navLabel}}</PageBreadcrumbs.Current>
      </PageBreadcrumbs>
      <PageTitle>{{navLabel}}</PageTitle>
      <EmptyState title="{{navLabel}}" layout="vertical">
        <Text>{{description}}</Text>
        <Button onClick={openTarget}>Open {{navLabel}}</Button>
      </EmptyState>
    </>
  );
};
