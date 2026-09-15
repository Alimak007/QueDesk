import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={Compass}
        title="We couldn’t find that page"
        description="The page may have moved, or you may not have access to it."
        action={
          <Button as={Link} to="/">
            Back to dashboard
          </Button>
        }
      />
    </Card>
  );
}
