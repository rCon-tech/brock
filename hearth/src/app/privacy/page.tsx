import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

export default function Privacy() {
  return (
    <article className="flex flex-col gap-4 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_p]:text-muted [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p>
        Hearth keeps as little as it needs to find the style you share. Here is what that means.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          The first name you give, and the cards you swipe, veto and react to, with any notes you
          write.
        </li>
        <li>
          The room details you choose: what you’re keeping, who lives there, size limits and budget.
        </li>
        <li>If you sign in with Google: your name and email address, from Google.</li>
        <li>
          When you click a buy button: which item, and which room it came from. Not who you are
          beyond that.
        </li>
        <li>If you join a waiting list: your email address and what you tell us.</li>
      </ul>

      <h2>Guests</h2>
      <p>
        You don’t need an account to use Hearth. A guest gets a random identifier kept in a cookie
        so you can come back to your room. It’s used for nothing else. If you later sign in with
        Google, everything you did as a guest moves to your account.
      </p>

      <h2>Who sees what</h2>
      <p>
        People in your room see each other’s first names, reactions and notes on the shared board.
        Nobody sees another person’s swipes. Deal-breakers show on the board without saying whose
        they are.
      </p>

      <h2>AI</h2>
      <p>
        Once a board is built, an AI model (Claude, from Anthropic) writes its name and explanation.
        It receives the first names of the people in the room, and labels such as “brass” or “clean
        lines”. It does not receive your email address or your individual swipes.
      </p>

      <h2>Your rights</h2>
      <p>
        You can download everything we hold about you and delete it from Settings at any time.
        Deleting removes you and what you added. A room you started carries on for the others if
        anyone is still in it.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        Hearth uses one cookie to remember who you are in your rooms. It doesn’t use advertising
        cookies.
      </p>
    </article>
  );
}
