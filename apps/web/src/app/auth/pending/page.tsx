import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Inscription en attente</CardTitle>
          <CardDescription>
            Votre demande a été envoyée à la mairie de votre commune.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vous recevrez un email dès que votre compte aura été validé par un
            agent municipal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
