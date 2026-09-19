import { useEffect } from 'react';
import { Button, EmptyState, Text, useExtensionActions } from '@hubspot/ui-extensions';
import { PageBreadcrumbs, PageTitle } from '@hubspot/ui-extensions/pages';

// HubSpot's UI Extensions runtime does not support an inline <iframe>; the only
// supported mechanism is openIframeModal (a modal dialog). This page opens the
// target URL in that modal automatically on load, and offers a button to reopen
// it if the visitor closes the modal.
export const HomePage = () => {
  const { openIframeModal } = useExtensionActions();

  const openTarget = () => {
    openIframeModal({
      uri: '{{targetUrl}}',
      height: 900,
      width: 1400,
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
